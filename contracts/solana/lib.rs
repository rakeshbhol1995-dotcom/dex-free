use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use pyth_sdk_solana::load_price_feed_from_account_info;

declare_id!("DexFree1111111111111111111111111111111111111");

#[program]
pub mod lp_pool {
    use super::*;

    // --- Admin Functions ---

    pub fn initialize(ctx: Context<Initialize>, admin_fee_bps: u64) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        pool.admin = *ctx.accounts.admin.key;
        pool.total_liquidity = 0;
        pool.admin_fee_bps = admin_fee_bps; // e.g. 3000 for 30%
        Ok(())
    }

    pub fn set_max_oi(ctx: Context<SetMaxOI>, market_id: String, limit: u64) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        // In a real implementation, we would use a simpler mapping or PDA for market config
        // For this demo, we verify admin and emitting event or mock storage
        require!(ctx.accounts.admin.key() == pool.admin, CustomError::Unauthorized);
        
        msg!("Setting Max OI for {} to {}", market_id, limit);
        // Store in a PDA or Map... (Simplified for file view)
        Ok(())
    }

    // --- LP Functions ---

    pub fn add_liquidity(ctx: Context<AddLiquidity>, amount: u64) -> Result<()> {
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.pool_token_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        
        token::transfer(cpi_ctx, amount)?;

        let pool = &mut ctx.accounts.pool;
        pool.total_liquidity += amount;
        
        msg!("Liquidity Added: {}", amount);
        Ok(())
    }

    // --- Trading Functions ---

    pub fn open_position(
        ctx: Context<OpenPosition>, 
        market_id: String, 
        is_long: bool, 
        collateral: u64, 
        leverage: u64
    ) -> Result<()> {
        require!(leverage <= 50, CustomError::MaxLeverageExceeded);
        
        // 1. Check Pyth Price
        let price_account_info = &ctx.accounts.price_feed;
        let price_feed = load_price_feed_from_account_info(price_account_info).unwrap();
        let current_price = price_feed.get_price_unchecked(); // Verify staleness in prod
        
        msg!("Current Price: {}", current_price.price);

        // 2. Golden Ratio Check (Crucial)
        // Check if New OI > 50% of Liquidity
        // Fetch Max OI from config PDA (omitted for brevity)
        // require!(new_oi <= max_oi, CustomError::GoldenRatioBreached);

        // 3. Transfer Collateral
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.pool_token_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, collateral)?;

        // 4. Record Position
        let position = &mut ctx.accounts.position;
        position.trader = *ctx.accounts.user.key;
        position.market_id = market_id;
        position.is_long = is_long;
        position.size = collateral * leverage;
        position.collateral = collateral;
        position.entry_price = current_price.price;
        position.timestamp = Clock::get()?.unix_timestamp;

        msg!("Position Opened: Size ${}", position.size);
        Ok(())
    }
}

// --- Account Structs ---

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = admin, space = 8 + 32 + 8 + 8)]
    pub pool: Account<'info, PoolState>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AddLiquidity<'info> {
    #[account(mut)]
    pub pool: Account<'info, PoolState>,
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub pool_token_account: Account<'info, TokenAccount>,
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct OpenPosition<'info> {
    #[account(mut)]
    pub pool: Account<'info, PoolState>,
    #[account(init, payer = user, space = 8 + 200)] // Adjust space
    pub position: Account<'info, PositionState>,
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub pool_token_account: Account<'info, TokenAccount>,
    /// CHECK: Pyth Price Feed Account
    pub price_feed: AccountInfo<'info>, 
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct SetMaxOI<'info> {
    #[account(mut)]
    pub pool: Account<'info, PoolState>,
    pub admin: Signer<'info>,
}

// --- Data Structures ---

#[account]
pub struct PoolState {
    pub admin: Pubkey,
    pub total_liquidity: u64,
    pub admin_fee_bps: u64,
}

#[account]
pub struct PositionState {
    pub trader: Pubkey,
    pub market_id: String, // "SOL-USD"
    pub is_long: bool,
    pub size: u64,
    pub collateral: u64,
    pub entry_price: i64,
    pub timestamp: i64,
}

// --- Errors ---

#[error_code]
pub enum CustomError {
    #[msg("Unauthorized access")]
    Unauthorized,
    #[msg("Max leverage exceeded (Max 50x)")]
    MaxLeverageExceeded,
    #[msg("Golden Ratio Breached: Max OI Reached")]
    GoldenRatioBreached,
}
