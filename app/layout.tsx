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

import type { Metadata } from 'next'
import { DM_Sans, Space_Grotesk, Space_Mono } from 'next/font/google'
import './globals.css'

// The three families the onramp widget ships under its `arc` brand: DM Sans for
// body and headers, Space Grotesk for large display type, Space Mono for code.
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans' })
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' })
const spaceMono = Space_Mono({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-space-mono' })

export const metadata: Metadata = {
  title: 'MonYuny',
  description: 'Social Bank #MonYuny',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`h-full font-sans antialiased ${dmSans.variable} ${spaceGrotesk.variable} ${spaceMono.variable}`}
    >
      <body className="flex h-dvh flex-col overflow-hidden bg-app-canvas text-foreground bg-[radial-gradient(color-mix(in_oklch,var(--color-device-frame-border)_60%,transparent)_1px,transparent_1px)] bg-[size:28px_28px]">
        {children}
      </body>
    </html>
  )
}
