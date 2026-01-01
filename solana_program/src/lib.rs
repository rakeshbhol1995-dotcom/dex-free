use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, MintTo, Transfer};

// ⚠️ REPLACE THIS WITH YOUR PROGRAM ID WHEN DEPLOYING
declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod fair_launch {
    use super::*;

    // 1. Initialize Global Configuration (Singleton)
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.admin = ctx.accounts.admin.key();
        config.fee_bps = 100; // 1%
        config.fee_recipient = ctx.accounts.admin.key();
        config.paused = false;
        msg!("Config initialized by: {}", config.admin);
        Ok(())
    }

    // 2. Create Token & Bonding Curve
    pub fn create_token(
        ctx: Context<CreateToken>, 
        name: String, 
        symbol: String,
        bump: u8
    ) -> Result<()> {
        let config = &ctx.accounts.config;
        require!(!config.paused, CustomError::ContractPaused);

        let curve_state = &mut ctx.accounts.curve_state;
        curve_state.creator = ctx.accounts.creator.key();
        curve_state.token_mint = ctx.accounts.token_mint.key();
        curve_state.bump = bump;
        
        // Initial Bonding Curve State
        curve_state.virtual_sol_res = 30 * 1_000_000_000; // 30 SOL
        curve_state.virtual_token_res = 1_073_000_000 * 1_000_000; // ~1B Tokens
        curve_state.real_sol_res = 0;
        curve_state.real_token_res = 1_000_000_000 * 1_000_000; // 1B Supply
        curve_state.market_cap_limit = 85 * 1_000_000_000; // 85 SOL target
        curve_state.graduated = false;

        // Mint Supply to Vault
        let seeds = &[
            b"curve_state",
            ctx.accounts.token_mint.to_account_info().key.as_ref(),
            &[bump],
        ];
        let signer = &[&seeds[..]];

        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.token_mint.to_account_info(),
                    to: ctx.accounts.curve_token_vault.to_account_info(),
                    authority: ctx.accounts.curve_state.to_account_info(),
                },
                signer,
            ),
            1_000_000_000 * 1_000_000,
        )?;

        msg!("Token Created: {} ({})", name, symbol);
        Ok(())
    }

    // 3. Buy Tokens (PRODUCTION: CEI + Overflow + Slippage + Rate Limit)
    pub fn buy_tokens(
        ctx: Context<BuyTokens>,
        amount_in_sol: u64,
        min_tokens_out: u64,  // Slippage protection
    ) -> Result<()> {
        let config = &ctx.accounts.config;
        let curve_state = &mut ctx.accounts.curve_state;
        
        // Pre-flight checks
        require!(!config.paused, CustomError::ContractPaused);
        require!(!curve_state.graduated, CustomError::AlreadyGraduated);
        require!(amount_in_sol > 0, CustomError::InvalidAmount);
        
        // Rate limiting: 5 second cooldown between buys
        let clock = Clock::get()?;
        let current_time = clock.unix_timestamp as u64;
        require!(
            current_time >= curve_state.last_trade_time + 5,
            CustomError::RateLimitExceeded
        );
        
        // Max buy limit: 5 SOL per transaction (anti-whale)
        require!(
            amount_in_sol <= 5 * 1_000_000_000,
            CustomError::ExceedsMaxBuy
        );

        // 1. Calculate amounts
        let fee = amount_in_sol
            .checked_div(100)
            .ok_or(CustomError::ArithmeticOverflow)?;
        let sol_in_after_fee = amount_in_sol
            .checked_sub(fee)
            .ok_or(CustomError::ArithmeticOverflow)?;

        // 2. Bonding Curve Math with overflow protection
        let numerator = (curve_state.virtual_token_res as u128)
            .checked_mul(sol_in_after_fee as u128)
            .ok_or(CustomError::ArithmeticOverflow)?;
        let denominator = (curve_state.virtual_sol_res as u128)
            .checked_add(sol_in_after_fee as u128)
            .ok_or(CustomError::ArithmeticOverflow)?;
        let tokens_out: u64 = (numerator / denominator)
            .try_into()
            .map_err(|_| CustomError::ArithmeticOverflow)?;

        require!(tokens_out > 0, CustomError::InsufficientOutput);
        
        // Slippage protection
        require!(
            tokens_out >= min_tokens_out,
            CustomError::SlippageExceeded
        );
        
        // FIX #5: Check VIRTUAL reserves (not real)
        require!(
            curve_state.virtual_token_res >= tokens_out,
            CustomError::InsufficientLiquidity
        );

        // 3. EFFECTS: Execute transfers FIRST (CEI Pattern)
        
        // Transfer SOL: User -> Curve PDA
        anchor_lang::solana_program::program::invoke(
            &anchor_lang::solana_program::system_instruction::transfer(
                &ctx.accounts.buyer.key(),
                &ctx.accounts.curve_state.to_account_info().key(),
                sol_in_after_fee,
            ),
            &[
                ctx.accounts.buyer.to_account_info(),
                ctx.accounts.curve_state.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        // Transfer Fee: User -> Fee Recipient
        anchor_lang::solana_program::program::invoke(
            &anchor_lang::solana_program::system_instruction::transfer(
                &ctx.accounts.buyer.key(),
                &ctx.accounts.fee_recipient.key(),
                fee,
            ),
            &[
                ctx.accounts.buyer.to_account_info(),
                ctx.accounts.fee_recipient.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        // Transfer Tokens: Vault -> User
        let seeds = &[
            b"curve_state",
            curve_state.token_mint.as_ref(),
            &[curve_state.bump],
        ];
        let signer = &[&seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.curve_token_vault.to_account_info(),
                    to: ctx.accounts.buyer_token_account.to_account_info(),
                    authority: ctx.accounts.curve_state.to_account_info(),
                },
                signer,
            ),
            tokens_out,
        )?;

        // 4. INTERACTIONS: Update state AFTER successful transfers
        curve_state.virtual_sol_res = curve_state.virtual_sol_res
            .checked_add(sol_in_after_fee)
            .ok_or(CustomError::ArithmeticOverflow)?;
        curve_state.virtual_token_res = curve_state.virtual_token_res
            .checked_sub(tokens_out)
            .ok_or(CustomError::ArithmeticOverflow)?;
        curve_state.real_sol_res = curve_state.real_sol_res
            .checked_add(sol_in_after_fee)
            .ok_or(CustomError::ArithmeticOverflow)?;
        curve_state.real_token_res = curve_state.real_token_res
            .checked_sub(tokens_out)
            .ok_or(CustomError::ArithmeticOverflow)?;

        // Update last trade time
        curve_state.last_trade_time = current_time;
        
        // Emit event
        emit!(TokenPurchased {
            token_mint: curve_state.token_mint,
            buyer: ctx.accounts.buyer.key(),
            sol_amount: amount_in_sol,
            tokens_received: tokens_out,
            new_virtual_sol_reserve: curve_state.virtual_sol_res,
            new_virtual_token_reserve: curve_state.virtual_token_res,
        });

        msg!("Bought {} tokens for {} SOL", tokens_out, amount_in_sol);

        // Check graduation
        if curve_state.virtual_sol_res >= curve_state.market_cap_limit {
            emit!(GraduationReady {
                token_mint: curve_state.token_mint,
                final_market_cap: curve_state.virtual_sol_res,
            });
            msg!("🎓 Target Met! Ready to graduate.");
        }

        Ok(())
    }

    // 4. Sell Tokens (PRODUCTION: CPI + Slippage + Rate Limit)
    pub fn sell_tokens(
        ctx: Context<SellTokens>,
        amount_tokens_in: u64,
        min_sol_out: u64,  // Slippage protection
    ) -> Result<()> {
        let config = &ctx.accounts.config;
        let curve_state = &mut ctx.accounts.curve_state;

        // Pre-flight checks
        require!(!config.paused, CustomError::ContractPaused);
        require!(!curve_state.graduated, CustomError::AlreadyGraduated);
        require!(amount_tokens_in > 0, CustomError::InvalidAmount);
        
        // Rate limiting: 5 second cooldown
        let clock = Clock::get()?;
        let current_time = clock.unix_timestamp as u64;
        require!(
            current_time >= curve_state.last_trade_time + 5,
            CustomError::RateLimitExceeded
        );

        // 1. Calculate SOL output
        let numerator = (curve_state.virtual_sol_res as u128)
            .checked_mul(amount_tokens_in as u128)
            .ok_or(CustomError::ArithmeticOverflow)?;
        let denominator = (curve_state.virtual_token_res as u128)
            .checked_add(amount_tokens_in as u128)
            .ok_or(CustomError::ArithmeticOverflow)?;
        let sol_out_gross: u64 = (numerator / denominator)
            .try_into()
            .map_err(|_| CustomError::ArithmeticOverflow)?;

        let fee = sol_out_gross
            .checked_div(100)
            .ok_or(CustomError::ArithmeticOverflow)?;
        let sol_out_net = sol_out_gross
            .checked_sub(fee)
            .ok_or(CustomError::ArithmeticOverflow)?;

        require!(sol_out_net > 0, CustomError::InsufficientOutput);
        
        // Slippage protection
        require!(
            sol_out_net >= min_sol_out,
            CustomError::SlippageExceeded
        );

        // 2. EFFECTS: Execute transfers FIRST
        
        // Transfer Tokens: User -> Vault
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.seller_token_account.to_account_info(),
                    to: ctx.accounts.curve_token_vault.to_account_info(),
                    authority: ctx.accounts.seller.to_account_info(),
                },
            ),
            amount_tokens_in,
        )?;

        // FIX #4: Use CPI instead of direct lamport manipulation
        // Transfer SOL: Curve PDA -> User
        let seeds = &[
            b"curve_state",
            curve_state.token_mint.as_ref(),
            &[curve_state.bump],
        ];
        let signer = &[&seeds[..]];

        anchor_lang::solana_program::program::invoke_signed(
            &anchor_lang::solana_program::system_instruction::transfer(
                &ctx.accounts.curve_state.to_account_info().key(),
                &ctx.accounts.seller.key(),
                sol_out_net,
            ),
            &[
                ctx.accounts.curve_state.to_account_info(),
                ctx.accounts.seller.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            signer,
        )?;

        // Transfer Fee: Curve PDA -> Fee Recipient
        anchor_lang::solana_program::program::invoke_signed(
            &anchor_lang::solana_program::system_instruction::transfer(
                &ctx.accounts.curve_state.to_account_info().key(),
                &ctx.accounts.fee_recipient.key(),
                fee,
            ),
            &[
                ctx.accounts.curve_state.to_account_info(),
                ctx.accounts.fee_recipient.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            signer,
        )?;

        // 3. INTERACTIONS: Update state AFTER successful transfers
        curve_state.virtual_sol_res = curve_state.virtual_sol_res
            .checked_sub(sol_out_gross)
            .ok_or(CustomError::ArithmeticOverflow)?;
        curve_state.virtual_token_res = curve_state.virtual_token_res
            .checked_add(amount_tokens_in)
            .ok_or(CustomError::ArithmeticOverflow)?;
        curve_state.real_sol_res = curve_state.real_sol_res
            .checked_sub(sol_out_gross)
            .ok_or(CustomError::ArithmeticOverflow)?;
        curve_state.real_token_res = curve_state.real_token_res
            .checked_add(amount_tokens_in)
            .ok_or(CustomError::ArithmeticOverflow)?;

        // Update last trade time
        curve_state.last_trade_time = current_time;
        
        // Emit event
        emit!(TokenSold {
            token_mint: curve_state.token_mint,
            seller: ctx.accounts.seller.key(),
            tokens_amount: amount_tokens_in,
            sol_received: sol_out_net,
            new_virtual_sol_reserve: curve_state.virtual_sol_res,
            new_virtual_token_reserve: curve_state.virtual_token_res,
        });

        msg!("Sold {} tokens for {} SOL", amount_tokens_in, sol_out_net);
        Ok(())
    }

    // 5. Pause Trading (Admin Only)
    pub fn pause(ctx: Context<AdminAction>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.paused = true;
        msg!("🚨 Trading PAUSED by admin");
        Ok(())
    }

    // 6. Unpause Trading (Admin Only)
    pub fn unpause(ctx: Context<AdminAction>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.paused = false;
        msg!("✅ Trading RESUMED");
        Ok(())
    }

    // 7. Update Fee Recipient (Admin Only)
    pub fn update_fee_recipient(
        ctx: Context<AdminAction>,
        new_recipient: Pubkey
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.fee_recipient = new_recipient;
        msg!("Fee recipient updated to: {}", new_recipient);
        Ok(())
    }
}

// --- Data Structures ---

#[account]
pub struct Config {
    pub admin: Pubkey,        // 32
    pub fee_recipient: Pubkey, // 32
    pub fee_bps: u16,         // 2
    pub paused: bool,         // 1
}

#[account]
pub struct CurveState {
    pub creator: Pubkey,           // 32
    pub token_mint: Pubkey,        // 32
    pub virtual_sol_res: u64,       // 8
    pub virtual_token_res: u64,     // 8
    pub real_sol_res: u64,          // 8
    pub real_token_res: u64,        // 8
    pub market_cap_limit: u64,      // 8
    pub graduated: bool,            // 1
    pub bump: u8,                   // 1
    pub last_trade_time: u64,       // 8 (Rate limiting)
}

// --- Contexts ---

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + 32 + 32 + 2 + 1,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(name: String, symbol: String, bump: u8)]
pub struct CreateToken<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    
    pub config: Account<'info, Config>,
    
    #[account(
        init,
        payer = creator,
        mint::decimals = 6,
        mint::authority = curve_state,
        mint::freeze_authority = curve_state,
    )]
    pub token_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = creator,
        space = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 1 + 1 + 8,
        seeds = [b"curve_state", token_mint.key().as_ref()],
        bump
    )]
    pub curve_state: Account<'info, CurveState>,

    #[account(
        init,
        payer = creator,
        token::mint = token_mint,
        token::authority = curve_state,
        seeds = [b"token_vault", token_mint.key().as_ref()],
        bump
    )]
    pub curve_token_vault: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct BuyTokens<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    
    pub config: Account<'info, Config>,
    
    #[account(mut)]
    pub curve_state: Account<'info, CurveState>,
    
    #[account(mut)]
    pub curve_token_vault: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub buyer_token_account: Account<'info, TokenAccount>,
    
    // FIX #1: Validate fee recipient matches config
    #[account(
        mut,
        constraint = fee_recipient.key() == config.fee_recipient @ CustomError::InvalidFeeRecipient
    )]
    /// CHECK: Validated via constraint
    pub fee_recipient: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SellTokens<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    pub config: Account<'info, Config>,

    #[account(mut)]
    pub curve_state: Account<'info, CurveState>,

    #[account(mut)]
    pub curve_token_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub seller_token_account: Account<'info, TokenAccount>,

    // FIX #1: Validate fee recipient
    #[account(
        mut,
        constraint = fee_recipient.key() == config.fee_recipient @ CustomError::InvalidFeeRecipient
    )]
    /// CHECK: Validated via constraint
    pub fee_recipient: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AdminAction<'info> {
    #[account(
        mut,
        has_one = admin @ CustomError::Unauthorized
    )]
    pub config: Account<'info, Config>,
    pub admin: Signer<'info>,
}

// --- Events ---

#[event]
pub struct TokenPurchased {
    pub token_mint: Pubkey,
    pub buyer: Pubkey,
    pub sol_amount: u64,
    pub tokens_received: u64,
    pub new_virtual_sol_reserve: u64,
    pub new_virtual_token_reserve: u64,
}

#[event]
pub struct TokenSold {
    pub token_mint: Pubkey,
    pub seller: Pubkey,
    pub tokens_amount: u64,
    pub sol_received: u64,
    pub new_virtual_sol_reserve: u64,
    pub new_virtual_token_reserve: u64,
}

#[event]
pub struct GraduationReady {
    pub token_mint: Pubkey,
    pub final_market_cap: u64,
}

// --- Errors ---

#[error_code]
pub enum CustomError {
    #[msg("Amount must be greater than zero")]
    InvalidAmount,
    #[msg("Slippage tolerance exceeded")]
    InsufficientOutput,
    #[msg("Insufficient liquidity in the curve")]
    InsufficientLiquidity,
    #[msg("Token has already graduated")]
    AlreadyGraduated,
    #[msg("Arithmetic overflow detected")]
    ArithmeticOverflow,
    #[msg("Fee recipient does not match config")]
    InvalidFeeRecipient,
    #[msg("Unauthorized: Admin only")]
    Unauthorized,
    #[msg("Contract is paused")]
    ContractPaused,
    #[msg("User-specified minimum tokens not received")]
    SlippageExceeded,
    #[msg("Rate limit: Wait 5 seconds between trades")]
    RateLimitExceeded,
    #[msg("Exceeds maximum buy limit (5 SOL)")]
    ExceedsMaxBuy,
}
