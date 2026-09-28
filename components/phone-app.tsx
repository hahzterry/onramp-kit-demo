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

// The widget renders inside the phone. Setting NEXT_PUBLIC_ONRAMP_POPUP to 1 or
// true opts into opening the hosted experience in a popup window instead, which
// is the escape hatch for providers whose own `frame-ancestors` refuse to be
// nested inside a host origin. It has to be read as this exact expression: Next
// inlines it at build time, so destructuring or dynamic lookup won't work, and
// `next dev` only picks up a change on restart.
const POPUP_REQUESTED = ['1', 'true'].includes(
  (process.env.NEXT_PUBLIC_ONRAMP_POPUP ?? '').trim().toLowerCase()
)

// USDC only, and only on chains a MetaMask address can actually receive on.
// `assets` fields combine with AND semantics, so this is "USDC on these chains".
// This is display-scoping only. Circle's catalog stays the source of truth.
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

// The widget letterboxes its content against `--onramp-surround`, which its
// launch URL exposes as a `bgcolor` hex. It defaults to the same navy this app
// now uses, so this only matters if either side's surface colour moves — but
// pinning it means the seam can't reappear.
const SURROUND = '#0d1b2f'

function tintSurround(session: OnrampSession): OnrampSession {
  // Bare-token sessions have no URL to rewrite; the kit composes one itself.
  if (typeof session.widgetUrl !== 'string') return session
  const url = new URL(session.widgetUrl)
  url.searchParams.set('bgcolor', SURROUND)
  return { ...session, widgetUrl: url.toString() }
}

const order = tabs.map((tab) => tab.id)

export function PhoneApp({
  environment,
}: {
  /** Resolved on the server from the two base URLs. */
  environment: OnrampEnvironment
}) {
  // Embedding is a sandbox-only capability. The production widget only accepts
  // being framed by origins registered with Circle, so a demo served from
  // localhost gets a cross-origin refusal and an empty sheet instead of the
  // flow. Popup mode has no such constraint, so production always uses it —
  // whatever NEXT_PUBLIC_ONRAMP_POPUP says.
  const popup = POPUP_REQUESTED || environment === 'production'

  const [tab, setTab] = useState<TabId>('home')
  const [enter, setEnter] = useState('animate-screen-in')

  const [address, setAddress] = useState<string | null>(null)
  // Set once the wallet has been asked whether it is already connected. Until
  // then "no address" means "not asked yet", and announcing a disconnected
  // wallet would flash at every user who has one connected.
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
  // Lazily constructed so nothing touches `window` during SSR. The getter is
  // synchronous, which openWindow requires.
  const getKit = () => (kitRef.current ??= createOnrampKit({ widgetBaseUrl: WIDGET_BASE_URL }))

  // Sessions are single-use and openWindow must run synchronously inside the
  // click handler, so one is always minted ahead of time.
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

  // USDC on whichever chain MetaMask has selected, polled through the wallet's
  // own provider and shown purely as context — the chain is named on screen.
  // `refresh` re-reads it at the moments a poll would otherwise lag behind.
  const { balance, chain, unsupported, switchTarget, switchNetwork, refresh } = useBalance(address)

  // The single place an address enters the app, so minting stays an event
  // reaction rather than something an effect has to chase.
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

  // Restore an already-connected MetaMask account without prompting, and stay
  // subscribed to account switches.
  useEffect(() => {
    const provider = window.ethereum

    // Resolves in every case, a missing wallet extension included, so the
    // screen can tell "not asked yet" from "nothing connected".
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

  // Clearing site data doesn't disconnect anything: the eth_accounts grant
  // lives in MetaMask, keyed by origin, so it has to be revoked there.
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

  // Every widget event, from either transport. Deposits become activity rows;
  // a finished deposit also dates the balance, so it is re-read here.
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

  // Embedded mode. The widget lives in a sheet over the phone screen, so it
  // goes up with the sheet and comes down with it. Nothing re-mints here: the
  // mount consumes the session, and minting on every mount would feed the
  // effect its own next session forever.
  const containerRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const container = containerRef.current
    if (!sheetOpen || !session || !address || !container) return

    const widget = getKit().mountIframe({
      session: tintSurround(session),
      container,
      onAnyEvent: handleEvent,
      // Covers an expiry mid-flow and a token the widget rejects outright.
      onSessionExpired: () => mintSession(address),
    })
    return () => widget.close()
  }, [sheetOpen, session, address, mintSession, handleEvent])

  // Closing consumes nothing further, but the mount already spent the session,
  // so the next purchase needs a fresh one.
  const closeSheet = () => {
    setSheetOpen(false)
    if (!address) return
    void mintSession(address)
    // A deposit can settle in the seconds around the close, which produces no
    // event once the iframe is gone. Re-reading here catches that case.
    refresh()
  }

  // Inert without a wallet, and on a chain the balance can't be read on: a
  // purchase would still be delivered there, but the screen has no figure to
  // move afterwards, so the prompt under the balance is the thing to do first.
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

    // The session just got consumed either way, so mint the next one.
    mintSession(address)
  }

  return (
    <div className="relative flex h-full flex-col bg-background">
      <StatusBar />
      {environment === 'sandbox' && (
        // Sits above the sheet, so it stays visible while the widget is open.
        <div className="flex shrink-0 items-center justify-center gap-2 bg-muted py-1.5 text-xs font-medium tracking-tight text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary" />
          Sandbox · no real money moves
        </div>
      )}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div key={tab} className={`flex min-h-0 flex-1 flex-col ${enter}`}>
          {tab === 'home' ? (
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
          ) : (
            <WalletScreen address={address} onConnect={connect} onDisconnect={disconnect} />
          )}
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
