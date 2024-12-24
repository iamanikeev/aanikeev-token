use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Program is already initialized")]
    ProgramIsAlreadyInitialized,
    #[msg("Program is not initialized")]
    ProgramIsNotInitialized,
    #[msg("Operation not allowed")]
    OperationNotAllowed,
    #[msg("Change authority error")]
    ChangeAuthorityForbidden,
    #[msg("Not permitted")]
    NotPermitted,
    #[msg("Invalid account")]
    InvalidAccount,
    #[msg("Invalid fee")]
    InvalidFeePercentage,
}
