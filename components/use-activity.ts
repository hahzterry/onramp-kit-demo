/**
 * Copyright 2026 Circle Internet Group, Inc.  All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { ONRAMP_EVENT_TYPES, type OnrampEventEnvelope } from '@circle-fin/onramp-kit'

/** The two widget events that describe a deposit, and so produce a row. */
export type DepositEnvelope = Extract<
  OnrampEventEnvelope,
  {
    event:
      | typeof ONRAMP_EVENT_TYPES.DEPOSIT_SUBMITTED
      | typeof ONRAMP_EVENT_TYPES.DEPOSIT_SETTLED
  }
>

export type ActivityEntry = {
  id: string
  status: 'pending' | 'settled'
  /** When the row was first recorded, in ms. */
  at: number
  /** Deposit amount in the source currency — not the token amount. */
  amount?: number
  tokenSymbol?: string
  paymentMethod?: string
  transactionHash?: string
}

const KEY_PREFIX = 'onramp-demo:activity:'

/** Rows kept per address. Old deposits fall off rather than growing forever. */
const LIMIT = 20

const keyFor = (address: string) => `${KEY_PREFIX}${address.toLowerCase()}`

/** Shared empty list, so an address with no history is a stable snapshot. */
const EMPTY: ActivityEntry[] = []

const listeners = new Set<() => void>()

// Snapshots have to be referentially stable between reads or
// useSyncExternalStore re-renders forever, so each address's parsed list is
// cached against the raw string it came from. A read allocates only when
// storage actually changed — including when another tab is the one that
// changed it.
const cache = new Map<string, { raw: string | null; value: ActivityEntry[] }>()

function read(address: string | null): ActivityEntry[] {
  if (!address) return EMPTY

  const key = keyFor(address)
  let raw: string | null
  try {
    raw = window.localStorage.getItem(key)
  } catch {
    // Storage can be disabled or partitioned. Behave like an empty history.
    return EMPTY
  }

  const cached = cache.get(key)
  if (cached && cached.raw === raw) return cached.value

  let value = EMPTY
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null
    if (Array.isArray(parsed)) value = parsed as ActivityEntry[]
  } catch {
    // Malformed. Start clean rather than break the screen.
  }

  cache.set(key, { raw, value })
  return value
}

function write(address: string, entries: ActivityEntry[]) {
  const key = keyFor(address)
  const raw = JSON.stringify(entries)

  // Seed the cache first: the snapshot is then correct even if the write below
  // is rejected, so the list still works for the rest of the session.
  cache.set(key, { raw, value: entries })
  try {
    window.localStorage.setItem(key, raw)
  } catch {
    // Storage full, disabled, or partitioned. Nothing to recover.
  }

  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  // `storage` only fires for other tabs, which is exactly the case the
  // in-process listener set does not cover.
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

function merge(entries: ActivityEntry[], envelope: DepositEnvelope): ActivityEntry[] {
  const { amount, tokenSymbol, paymentMethod, orderId, transactionHash, settlementExpected } =
    envelope.payload

  // Every payload field is best-effort. Without an orderId there is nothing to
  // correlate a later DEPOSIT_SETTLED against, so the event lands as its own
  // row instead of being folded into the one it probably belongs to.
  const id = orderId ?? `${envelope.event}-${Date.now()}`

  // `settlementExpected: false` means DEPOSIT_SUBMITTED is the last callback
  // for this deposit, so there is no pending state to wait out.
  const settled =
    envelope.event === ONRAMP_EVENT_TYPES.DEPOSIT_SETTLED || settlementExpected === false
  const status: ActivityEntry['status'] = settled ? 'settled' : 'pending'

  // Assigned one by one so an absent field never overwrites what an earlier
  // event already reported.
  const details: Partial<ActivityEntry> = {}
  if (amount !== undefined) details.amount = amount
  if (tokenSymbol !== undefined) details.tokenSymbol = tokenSymbol
  if (paymentMethod !== undefined) details.paymentMethod = paymentMethod
  if (transactionHash !== undefined) details.transactionHash = transactionHash

  if (!entries.some((entry) => entry.id === id)) {
    return [{ id, at: Date.now(), status, ...details }, ...entries].slice(0, LIMIT)
  }

  // A settled event repeats the deposit details, so this is a merge: `at` keeps
  // the time the deposit was first seen, and a settled row never goes back to
  // pending on a late-arriving event.
  return entries.map((entry) =>
    entry.id === id
      ? { ...entry, ...details, status: entry.status === 'settled' ? 'settled' : status }
      : entry,
  )
}

/**
 * Deposit rows for one address, persisted to localStorage.
 *
 * Only what the widget reports while it is open ever lands here: a deposit
 * that settles after the sheet closes produces no client-side event, so its
 * row stays pending. Resolving that needs an order ledger on the server.
 */
export function useActivity(address: string | null) {
  const entries = useSyncExternalStore(
    subscribe,
    () => read(address),
    // The server has no storage, so it renders the empty list and the real one
    // arrives on hydration — no mismatch to suppress.
    () => EMPTY,
  )

  const record = useCallback(
    (envelope: DepositEnvelope) => {
      if (!address) return
      write(address, merge(read(address), envelope))
    },
    [address],
  )

  return { entries, record }
}
