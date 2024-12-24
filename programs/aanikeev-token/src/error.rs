use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Program is already initialized")]
    ProgramIsAlreadyInitialized,
    #[msg("Program is not initialized")]
    ProgramIsNotInitialized,
    #[msg("Not permitted")]
    NotPermitted,
}
