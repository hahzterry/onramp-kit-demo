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

import { WalletIcon } from './icons'

export const tabs = [
  { id: 'bank',   icon: '🏦', label: 'Bank'   },
  { id: 'wallet', icon: '👛', label: 'Wallet' },
  { id: 'social', icon: '💬', label: 'Social' },
  { id: 'live',   icon: '🔴', label: 'Live'   },
] as const

export type TabId = (typeof tabs)[number]['id']

export function BottomNav({
  active,
  onChange,
}: {
  active: TabId
  onChange: (tab: TabId) => void
}) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-10 flex justify-center px-5 pt-3 pb-6">
      <div className="flex items-center gap-2 rounded-full bg-card/80 px-2 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.35)] ring-1 ring-border backdrop-blur-lg">
        {tabs.map(({ id, icon, label }) => (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={`flex w-[80px] flex-col items-center gap-0.5 rounded-[40px] py-2 transition-colors duration-200 ${
              active === id ? 'bg-muted' : 'text-muted-foreground/50'
            }`}
          >
            <span className="text-xl leading-none" role="img" aria-label={label}>
              {icon}
            </span>
            <span className="text-xs font-medium tracking-tight">{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}