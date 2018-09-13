import { createSelector } from 'reselect'
import { mapValues, dateSort } from 'Utilities/helpers'
import { getSwapStatus, getSwapFriendlyError } from 'Utilities/swap'
import { createItemSelector, selectItemId } from 'Utilities/selector'
import { toBigNumber } from 'Utilities/convert'
import { MultiWallet } from 'Services/Wallet'

import { getAllAssets } from './asset'
import { getAllWallets } from './wallet'
import { getAllTxs } from './tx'

export const getSwapState = ({ swap }) => swap

const createSwapExtender = (allAssets, allWallets, allTxs) => (swap) => {
  const { sendSymbol, receiveSymbol, txId, rate, receiveAddress, sendWalletId } = swap
  const sendAsset = allAssets[sendSymbol]
  const receiveAsset = allAssets[receiveSymbol]
  const tx = allTxs[txId] || {}
  const fee = toBigNumber(0)
  let { receiveWalletId } = swap
  let receiveWallet
  if (!receiveWalletId) {
    receiveWallet = Object.values(allWallets)
      .find((w) => !w.type.includes(MultiWallet.type)
        && (w.usedAddresses.includes(receiveAddress)
          || (swap.receiveAddress.startsWith('0x')
            && w.usedAddresses.includes(receiveAddress.toLowerCase()))))
    if (receiveWallet) {
      receiveWalletId = receiveWallet.id
    }
  }

  swap = {
    ...swap,
    sendWallet: allWallets[sendWalletId],
    receiveWallet,
    receiveWalletId,
    pair: `${sendSymbol}_${receiveSymbol}`.toLowerCase(),
    inverseRate: toBigNumber(rate).pow(-1),
    sendAsset,
    receiveAsset,
    fee,
    hasFee: fee && toBigNumber(fee).gt(0),
    tx,
    txSigning: tx.signing,
    txSigned: tx.signed,
    txSigningError: tx.signingError,
    txSending: tx.sending,
    txSent: tx.sent,
    txSendingError: tx.sendingError,
  }
  
  return {
    ...swap,
    status: getSwapStatus(swap),
    friendlyError: getSwapFriendlyError(swap),
  }
}

export const getAllSwaps = createSelector(
  getSwapState,
  getAllAssets,
  getAllWallets,
  getAllTxs,
  (allSwaps, allAssets, allWallets, allTxs) => mapValues(allSwaps, createSwapExtender(allAssets, allWallets, allTxs))
)

export const getAllSwapsArray = createSelector(
  getAllSwaps,
  (allSwaps) => dateSort(Object.values(allSwaps), 'desc', 'createdAt')
)

export const getSentSwaps = createSelector(
  getAllSwapsArray,
  (allSwaps) => allSwaps.filter(({ orderStatus, tx }) => orderStatus !== 'awaiting deposit' || tx.sent)
)

export const getSwap = createItemSelector(
  getAllSwaps,
  selectItemId,
  (allSwaps, id) => allSwaps[id] || Object.values(allSwaps).find((s) => s.orderId === id)
)

export const getSentSwapOrderTxIds = createSelector(
  getAllSwapsArray,
  getAllTxs,
  (allSwapsArray, allTxs) => allSwapsArray.reduce((byId, swap) => {
    const tx = allTxs[swap.txId]
    if (tx && tx.sent) {
      return {
        ...byId,
        [swap.orderId]: tx.id,
      }
    }
    return byId
  }, {})
)
