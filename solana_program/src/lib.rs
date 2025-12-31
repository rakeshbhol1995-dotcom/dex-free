use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod solana_fair_launch {
    use super::*;

    pub const VIRTUAL_SOL_RES: u64 = 30_000_000_000; // 30 SOL initial virtual reserve
    pub const VIRTUAL_TOKEN_RES: u64 = 1_073_000_000_000_000; // Virtual Supply > Real Supply
    pub const FUNDING_GOAL_SOL: u64 = 85_000_000_000; // 85 SOL Graduation Target
    pub const FEE_BPS: u64 = 20; // 0.2%

    pub fn initialize(ctx: Context<Initialize>, name: String, symbol: String) -> Result<()> {
        let curve_state = &mut ctx.accounts.curve_state;
        curve_state.authority = ctx.accounts.user.key();
        curve_state.token_mint = ctx.accounts.token_mint.key();
        curve_state.total_supply = 1_000_000_000_000_000; // 1 Billion
        curve_state.virtual_token_res = VIRTUAL_TOKEN_RES;
        curve_state.virtual_sol_res = VIRTUAL_SOL_RES;
        curve_state.tokens_sold = 0;
        curve_state.sol_collected = 0;
        curve_state.graduated = false;
        msg!("Initialized Curve for {} ({})", name, symbol);
        Ok(())
    }

    pub fn buy(ctx: Context<Buy>, amount_sol: u64) -> Result<()> {
        let curve_state = &mut ctx.accounts.curve_state;
        require!(!curve_state.graduated, CustomError::CurveGraduated);

        // 1. Calculate Fee (0.2%)
        let fee = amount_sol * FEE_BPS / 10000;
        let amount_invested = amount_sol - fee;

        // 2. Virtual Reserve Logic (x * y = k)
        // dy = (y * dx) / (x + dx)
        // x = virtual_sol_res, y = virtual_token_res
        let tokens_out = (curve_state.virtual_token_res * amount_invested) 
            / (curve_state.virtual_sol_res + amount_invested);

        // 3. Update State
        curve_state.virtual_sol_res += amount_invested;
        curve_state.virtual_token_res -= tokens_out;
        curve_state.tokens_sold += tokens_out;
        curve_state.sol_collected += amount_invested;

        // 4. Transfer SOL from User to Curve PDA
        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.user.key(),
            &ctx.accounts.curve_state.to_account_info().key(),
            amount_sol,
        );
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.user.to_account_info(),
                ctx.accounts.curve_state.to_account_info(),
            ],
        )?;

        // 5. Transfer Tokens from Curve Vault to User
        let seeds = &[
            b"curve".as_ref(),
            ctx.accounts.token_mint.to_account_info().key.as_ref(),
            &[ctx.bumps.curve_state],
        ];
        let signer = &[&seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.curve_token_account.to_account_info(),
                    to: ctx.accounts.user_token_account.to_account_info(),
                    authority: ctx.accounts.curve_state.to_account_info(),
                },
                signer,
            ),
            tokens_out,
        )?;

        msg!("Bought {} tokens for {} lamports", tokens_out, amount_sol);

        // 6. Check for Graduation
        if curve_state.sol_collected >= FUNDING_GOAL_SOL {
            curve_state.graduated = true;
            msg!("GRADUATED: Curve has reached funding goal!");
            emit!(GraduatedEvent {
                token_mint: curve_state.token_mint,
                sol_collected: curve_state.sol_collected,
            });
        }

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 1, // Added space for new fields
        seeds = [b"curve", token_mint.key().as_ref()],
        bump
    )]
    pub curve_state: Account<'info, CurveState>,
    pub token_mint: Account<'info, Mint>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Buy<'info> {
    #[account(
        mut,
        seeds = [b"curve", token_mint.key().as_ref()],
        bump
    )]
    pub curve_state: Account<'info, CurveState>,
    pub token_mint: Account<'info, Mint>,
    #[account(mut)]
    pub curve_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct CurveState {
    pub authority: Pubkey,
    pub token_mint: Pubkey,
    pub total_supply: u64,
    pub tokens_sold: u64,
    pub sol_collected: u64,
    // New Fields for Curve
    pub virtual_token_res: u64,
    pub virtual_sol_res: u64,
    pub graduated: bool,
}

#[event]
pub struct GraduatedEvent {
    pub token_mint: Pubkey,
    pub sol_collected: u64,
}

#[error_code]
pub enum CustomError {
    #[msg("The curve has graduated.")]
    CurveGraduated,
}
