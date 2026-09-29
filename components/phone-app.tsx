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

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ONRAMP_EVENT_TYPES,
  createOnrampKit,
  fetchOnrampSession,
  type OnrampEventEnvelope,
} from '@circle-fin/onramp-kit'
import { WIDGET_BASE_URL, type OnrampEnvironment } from '@/lib/onramp-environment'
import { BottomNav, tabs, type TabId } from './bottom-nav'
import { HomeScreen } from './home-screen'
import { OnrampSheet } from './onramp-sheet'
import { StatusBar } from './status-bar'
import { useActivity } from './use-activity'
import { useBalance } from './use-balance'
import { WalletScreen } from './wallet-screen'

type OnrampSession = Awaited<ReturnType<typeof fetchOnrampSession>>

const SESSION_URL = '/api/onramp/session'

const POPUP_REQUESTED = ['1', 'true'].includes(
  (process.env.NEXT_PUBLIC_ONRAMP_POPUP ?? '').trim().toLowerCase()
)

const ASSETS = {
  tokens: ['USDC'],
  chains: [
    'arc',
    'ethereum',
    'base',
    'arbitrum',
    'polygon',
    'linea',
    'avalanche',
    'unichain',
    'celo',
    'hyperevm',
    'ronin',
  ],
}

const SURROUND = '#0d1b2f'

function tintSurround(session: OnrampSession): OnrampSession {
  if (typeof session.widgetUrl !== 'string') return session
  const url = new URL(session.widgetUrl)
  url.searchParams.set('bgcolor', SURROUND)
  return { ...session, widgetUrl: url.toString() }
}

const order = tabs.map((tab) => tab.id)

export function PhoneApp({
  environment,
}: {
  environment: OnrampEnvironment
}) {
  const popup = POPUP_REQUESTED || environment === 'production'

  const [tab, setTab] = useState<TabId>('bank')
  const [enter, setEnter] = useState('animate-screen-in')

  const [address, setAddress] = useState<string | null>(null)
  const [probed, setProbed] = useState(false)
  const [session, setSession] = useState<OnrampSession | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const changeTab = (next: TabId) => {
    if (next === tab) return
    setEnter(
      order.indexOf(next) > order.indexOf(tab)
        ? 'animate-screen-in-right'
        : 'animate-screen-in-left',
    )
    setTab(next)
  }

  const kitRef = useRef<ReturnType<typeof createOnrampKit> | null>(null)
  const getKit = () => (kitRef.current ??= createOnrampKit({ widgetBaseUrl: WIDGET_BASE_URL }))

  const mintSession = useCallback(async (destinationAddress: string) => {
    setSession(null)
    try {
      const fresh = await fetchOnrampSession({
        url: SESSION_URL,
        body: {
          userId: destinationAddress,
          destinationAddress,
          assets: ASSETS,
        },
      })
      setSession(fresh)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create a session.')
    }
  }, [])

  const { balance, chain, unsupported, switchTarget, switchNetwork, refresh } = useBalance(address)

  const adoptAddress = useCallback(
    (next: string | null) => {
      setAddress(next)
      if (next) {
        void mintSession(next)
      } else {
        setSession(null)
        setSheetOpen(false)
      }
    },
    [mintSession],
  )

  useEffect(() => {
    const provider = window.ethereum

    const probe = provider
      ? provider
          .request({ method: 'eth_accounts' })
          .then((accounts) => (accounts as string[])[0] ?? null)
          .catch(() => null)
      : Promise.resolve(null)

    void probe.then((next) => {
      adoptAddress(next)
      setProbed(true)
    })

    if (!provider) return

    const onAccountsChanged = (...args: never[]) => {
      const accounts = args[0] as unknown as string[]
      adoptAddress(accounts[0] ?? null)
    }
    provider.on('accountsChanged', onAccountsChanged)
    return () => provider.removeListener('accountsChanged', onAccountsChanged)
  }, [adoptAddress])

  const connect = useCallback(async () => {
    setError(null)
    const provider = window.ethereum
    if (!provider?.isMetaMask) {
      setError('MetaMask not detected. Install it and reload the page.')
      return
    }
    try {
      const accounts = (await provider.request({
        method: 'eth_requestAccounts',
      })) as string[]
      adoptAddress(accounts[0] ?? null)
    } catch {
      setError('Wallet connection was rejected.')
    }
  }, [adoptAddress])

  const disconnect = useCallback(async () => {
    setError(null)
    try {
      await window.ethereum?.request({
        method: 'wallet_revokePermissions',
        params: [{ eth_accounts: {} }],
      })
    } catch {
      // Wallets that don't implement wallet_revokePermissions will reconnect
      // silently on reload. Dropping local state is all we can do for them.
    }
    adoptAddress(null)
  }, [adoptAddress])

  const { entries: activity, record } = useActivity(address)

  const handleEvent = useCallback(
    (envelope: OnrampEventEnvelope) => {
      console.log('onramp', envelope.event, envelope.payload)

      if (
        envelope.event !== ONRAMP_EVENT_TYPES.DEPOSIT_SUBMITTED &&
        envelope.event !== ONRAMP_EVENT_TYPES.DEPOSIT_SETTLED
      ) {
        return
      }

      record(envelope)

      const done =
        envelope.event === ONRAMP_EVENT_TYPES.DEPOSIT_SETTLED ||
        envelope.payload.settlementExpected === false
      if (done) refresh()
    },
    [record, refresh],
  )

  const containerRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const container = containerRef.current
    if (!sheetOpen || !session || !address || !container) return

    const widget = getKit().mountIframe({
      session: tintSurround(session),
      container,
      onAnyEvent: handleEvent,
      onSessionExpired: () => mintSession(address),
    })
    return () => widget.close()
  }, [sheetOpen, session, address, mintSession, handleEvent])

  const closeSheet = () => {
    setSheetOpen(false)
    if (!address) return
    void mintSession(address)
    refresh()
  }

  function addMoney() {
    if (!address || unsupported || !session) return
    setError(null)

    if (!popup) {
      setSheetOpen(true)
      return
    }

    const result = getKit().openWindow({ session })

    if (result.status === 'blocked') {
      setError(
        result.reason === 'popup_blocked'
          ? 'Your browser blocked the popup. Allow popups for this site and try again.'
          : `Popup unavailable (${result.reason}). ${result.errorMessage ?? ''}`,
      )
    } else {
      result.widget.on('*', handleEvent)
    }

    mintSession(address)
  }

  // ⚠️ Route every tab. Anything that falls through renders WalletScreen,
  // which is wrong for the newly added Social / Live tabs.
  function renderTab() {
    switch (tab) {
      case 'bank':
        return (
          <HomeScreen
            balance={Number(balance ?? 0)}
            balanceChain={chain?.label}
            prompt={
              probed && !address
                ? {
                    note: 'Wallet disconnected',
                    action: 'Connect a wallet',
                    onAction: () => changeTab('wallet'),
                  }
                : address && unsupported
                  ? {
                      note: 'Unsupported network',
                      action: `Switch to ${switchTarget.label}`,
                      onAction: switchNetwork,
                    }
                  : null
            }
            activity={activity}
            onAddMoney={addMoney}
            addMoneyHint={
              !address
                ? 'Connect a wallet'
                : unsupported
                  ? 'Switch to a supported network'
                  : !session
                    ? 'Preparing session…'
                    : null
            }
          />
        )

      case 'wallet':
        return (
          <WalletScreen
            address={address}
            onConnect={connect}
            onDisconnect={disconnect}
          />
        )

case 'social':
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="text-5xl" role="img" aria-label="Social">💬</span>
      <p className="text-sm text-muted-foreground">
        Forum, Feed, Q&A, and Ideas
      </p>
      <a
        href="https://social.monyuny.com"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-2 rounded-full bg-[#008CFF] px-5 py-3 text-sm font-semibold text-white shadow-[0_0_30px_rgba(0,140,255,0.2)] transition-colors hover:bg-[#19AFFF]"
      >
        Open Social →
      </a>
    </div>
  )

case 'live':
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="text-5xl" role="img" aria-label="Live">🔴</span>
      <p className="text-sm text-muted-foreground">
        Watch and tip livestreams
      </p>
      <a
        href="https://live.monyuny.com"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-2 rounded-full bg-[#FF3B5C] px-5 py-3 text-sm font-semibold text-white shadow-[0_0_30px_rgba(255,59,92,0.25)] transition-colors hover:bg-[#FF5C77]"
      >
        Open Livestream →
      </a>
    </div>
  )
    }
  }

  return (
    <div className="relative flex h-full flex-col bg-background">
      <StatusBar />
      {environment === 'sandbox' && (
        <div className="flex shrink-0 items-center justify-center gap-2 bg-muted py-1.5 text-xs font-medium tracking-tight text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary" />
          Sandbox · no real money moves
        </div>
      )}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div key={tab} className={`flex min-h-0 flex-1 flex-col ${enter}`}>
          {renderTab()}
        </div>
        <BottomNav active={tab} onChange={changeTab} />
        {sheetOpen && (
          <OnrampSheet containerRef={containerRef} ready={Boolean(session)} onClose={closeSheet} />
        )}
        {error && (
          <button
            type="button"
            onClick={() => setError(null)}
            className="absolute inset-x-5 bottom-[104px] z-30 rounded-lg bg-destructive px-4 py-3 text-left text-sm font-medium text-foreground shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
          >
            {error}
          </button>
        )}
      </div>
    </div>
  )
}