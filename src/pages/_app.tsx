import type { AppProps } from "next/app";
import type { NextComponentType, NextPageContext } from "next";
import { SessionProvider } from "next-auth/react";
import Head from "next/head";
import "../styles/globals.css";

type NextPageWithLayout = NextComponentType<NextPageContext, unknown, Record<string, unknown>> & {
  getLayout?: (page: React.ReactElement) => React.ReactNode;
};

type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout;
};

export default function App({ Component, pageProps: { session, ...pageProps } }: AppPropsWithLayout) {
  const getLayout = Component.getLayout ?? ((page: React.ReactElement) => page);

  return (
    <SessionProvider session={session}>
      <div className="font-sans">
        <Head>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>
        {getLayout(<Component {...pageProps} />)}
      </div>
    </SessionProvider>
  );
}
