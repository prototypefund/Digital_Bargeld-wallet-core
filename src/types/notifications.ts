/*
 This file is part of GNU Taler
 (C) 2019 GNUnet e.V.

 GNU Taler is free software; you can redistribute it and/or modify it under the
 terms of the GNU General Public License as published by the Free Software
 Foundation; either version 3, or (at your option) any later version.

 GNU Taler is distributed in the hope that it will be useful, but WITHOUT ANY
 WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 A PARTICULAR PURPOSE.  See the GNU General Public License for more details.

 You should have received a copy of the GNU General Public License along with
 GNU Taler; see the file COPYING.  If not, see <http://www.gnu.org/licenses/>
 */

/**
 * Type and schema definitions for notifications from the wallet to clients
 * of the wallet.
 */

/**
 * Imports.
 */
import { OperationError } from "./walletTypes";
import { WithdrawalSource } from "./dbTypes";

export const enum NotificationType {
  CoinWithdrawn = "coin-withdrawn",
  ProposalAccepted = "proposal-accepted",
  ProposalDownloaded = "proposal-downloaded",
  RefundsSubmitted = "refunds-submitted",
  RecoupStarted = "recoup-started",
  RecoupFinished = "recoup-finished",
  RefreshRevealed = "refresh-revealed",
  RefreshMelted = "refresh-melted",
  RefreshStarted = "refresh-started",
  RefreshUnwarranted = "refresh-unwarranted",
  ReserveUpdated = "reserve-updated",
  ReserveConfirmed = "reserve-confirmed",
  ReserveCreated = "reserve-created",
  WithdrawGroupCreated = "withdraw-group-created",
  WithdrawGroupFinished = "withdraw-group-finished",
  WaitingForRetry = "waiting-for-retry",
  RefundStarted = "refund-started",
  RefundQueried = "refund-queried",
  RefundFinished = "refund-finished",
  ExchangeOperationError = "exchange-operation-error",
  RefreshOperationError = "refresh-operation-error",
  RecoupOperationError = "recoup-operation-error",
  RefundApplyOperationError = "refund-apply-error",
  RefundStatusOperationError = "refund-status-error",
  ProposalOperationError = "proposal-error",
  TipOperationError = "tip-error",
  PayOperationError = "pay-error",
  WithdrawOperationError = "withdraw-error",
  ReserveOperationError = "reserve-error",
  Wildcard = "wildcard",
}

export interface ProposalAcceptedNotification {
  type: NotificationType.ProposalAccepted;
  proposalId: string;
}

export interface CoinWithdrawnNotification {
  type: NotificationType.CoinWithdrawn;
}

export interface RefundStartedNotification {
  type: NotificationType.RefundStarted;
}

export interface RefundQueriedNotification {
  type: NotificationType.RefundQueried;
}

export interface ProposalDownloadedNotification {
  type: NotificationType.ProposalDownloaded;
  proposalId: string;
}

export interface RefundsSubmittedNotification {
  type: NotificationType.RefundsSubmitted;
  proposalId: string;
}

export interface RecoupStartedNotification {
  type: NotificationType.RecoupStarted;
}

export interface RecoupFinishedNotification {
  type: NotificationType.RecoupFinished;
}

export interface RefreshMeltedNotification {
  type: NotificationType.RefreshMelted;
}

export interface RefreshRevealedNotification {
  type: NotificationType.RefreshRevealed;
}

export interface RefreshStartedNotification {
  type: NotificationType.RefreshStarted;
}

export interface RefreshRefusedNotification {
  type: NotificationType.RefreshUnwarranted;
}

export interface ReserveUpdatedNotification {
  type: NotificationType.ReserveUpdated;
}

export interface ReserveConfirmedNotification {
  type: NotificationType.ReserveConfirmed;
}

export interface WithdrawalGroupCreatedNotification {
  type: NotificationType.WithdrawGroupCreated;
  withdrawalGroupId: string;
}

export interface WithdrawalGroupFinishedNotification {
  type: NotificationType.WithdrawGroupFinished;
  withdrawalSource: WithdrawalSource;
}

export interface WaitingForRetryNotification {
  type: NotificationType.WaitingForRetry;
  numPending: number;
  numGivingLiveness: number;
}

export interface RefundFinishedNotification {
  type: NotificationType.RefundFinished;
}

export interface ExchangeOperationErrorNotification {
  type: NotificationType.ExchangeOperationError;
}

export interface RefreshOperationErrorNotification {
  type: NotificationType.RefreshOperationError;
}

export interface RefundStatusOperationErrorNotification {
  type: NotificationType.RefundStatusOperationError;
}

export interface RefundApplyOperationErrorNotification {
  type: NotificationType.RefundApplyOperationError;
}

export interface PayOperationErrorNotification {
  type: NotificationType.PayOperationError;
}

export interface ProposalOperationErrorNotification {
  type: NotificationType.ProposalOperationError;
}

export interface TipOperationErrorNotification {
  type: NotificationType.TipOperationError;
}

export interface WithdrawOperationErrorNotification {
  type: NotificationType.WithdrawOperationError;
}

export interface RecoupOperationErrorNotification {
  type: NotificationType.RecoupOperationError;
}

export interface ReserveOperationErrorNotification {
  type: NotificationType.ReserveOperationError;
  operationError: OperationError;
}

export interface ReserveCreatedNotification {
  type: NotificationType.ReserveCreated;
}

export interface WildcardNotification {
  type: NotificationType.Wildcard;
}

export type WalletNotification =
  | WithdrawOperationErrorNotification
  | ReserveOperationErrorNotification
  | ExchangeOperationErrorNotification
  | RefreshOperationErrorNotification
  | RefundStatusOperationErrorNotification
  | RefundApplyOperationErrorNotification
  | ProposalOperationErrorNotification
  | PayOperationErrorNotification
  | TipOperationErrorNotification
  | ProposalAcceptedNotification
  | ProposalDownloadedNotification
  | RefundsSubmittedNotification
  | RecoupStartedNotification
  | RecoupFinishedNotification
  | RefreshMeltedNotification
  | RefreshRevealedNotification
  | RefreshStartedNotification
  | RefreshRefusedNotification
  | ReserveUpdatedNotification
  | ReserveCreatedNotification
  | ReserveConfirmedNotification
  | WithdrawalGroupFinishedNotification
  | WaitingForRetryNotification
  | RefundStartedNotification
  | RefundFinishedNotification
  | RefundQueriedNotification
  | WithdrawalGroupCreatedNotification
  | CoinWithdrawnNotification
  | WildcardNotification
  | RecoupOperationErrorNotification;
