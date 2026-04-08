import './globals.css'

export const metadata = {
  title: 'Fitness Tracker',
  description: 'Personal fitness tracker and AI coach',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
