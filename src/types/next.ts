import type { NextPage } from "next";
import type React from "react";

export type NextPageWithLayout<P = object, IP = P> = NextPage<P, IP> & {
  getLayout?: (page: React.ReactElement) => React.ReactNode;
};
