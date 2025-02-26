// Type declarations for Next.js modules
declare module 'next/app' {
  import { AppProps as NextAppProps } from 'next/dist/shared/lib/router/router';
  export type AppProps = NextAppProps;
}

declare module 'next/head' {
  import React from 'react';
  export default function Head(props: React.PropsWithChildren<{}>): JSX.Element;
}

declare module 'next/link' {
  import React from 'react';
  
  export interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
    href: string;
    as?: string;
    replace?: boolean;
    scroll?: boolean;
    shallow?: boolean;
    passHref?: boolean;
    prefetch?: boolean;
  }
  
  export default function Link(props: React.PropsWithChildren<LinkProps>): JSX.Element;
}

declare module 'next/router' {
  export interface RouterProps {
    pathname: string;
    query: Record<string, string | string[]>;
    asPath: string;
    push: (url: string, as?: string, options?: any) => Promise<boolean>;
    replace: (url: string, as?: string, options?: any) => Promise<boolean>;
    reload: () => void;
    back: () => void;
    prefetch: (url: string) => Promise<void>;
    beforePopState: (cb: (state: any) => boolean) => void;
    events: {
      on: (event: string, handler: (...args: any[]) => void) => void;
      off: (event: string, handler: (...args: any[]) => void) => void;
      emit: (event: string, ...args: any[]) => void;
    };
    isFallback: boolean;
    isReady: boolean;
  }
  
  export function useRouter(): RouterProps;
}
