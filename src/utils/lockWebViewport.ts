import { Platform } from 'react-native';

/** Keep the web app inside the visible Safari/Chrome viewport so screens don’t crop. */
export function lockWebViewport() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return () => undefined;
  }

  const html = document.documentElement;
  const body = document.body;
  const root = document.getElementById('root');
  const meta = document.querySelector('meta[name="viewport"]');

  const previous = {
    htmlOverflow: html.style.overflow,
    htmlHeight: html.style.height,
    htmlOverscroll: html.style.overscrollBehavior,
    bodyOverflow: body.style.overflow,
    bodyHeight: body.style.height,
    bodyMargin: body.style.margin,
    bodyOverscroll: body.style.overscrollBehavior,
    rootHeight: root?.style.height ?? '',
    rootOverflow: root?.style.overflow ?? '',
    meta: meta?.getAttribute('content') ?? '',
  };

  html.style.height = '100svh';
  html.style.maxHeight = '100svh';
  html.style.overflow = 'hidden';
  html.style.overscrollBehavior = 'none';
  body.style.height = '100svh';
  body.style.maxHeight = '100svh';
  body.style.margin = '0';
  body.style.overflow = 'hidden';
  body.style.overscrollBehavior = 'none';
  if (root) {
    root.style.height = '100svh';
    root.style.maxHeight = '100svh';
    root.style.overflow = 'hidden';
  }
  meta?.setAttribute(
    'content',
    'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover'
  );

  return () => {
    html.style.overflow = previous.htmlOverflow;
    html.style.height = previous.htmlHeight;
    html.style.overscrollBehavior = previous.htmlOverscroll;
    body.style.overflow = previous.bodyOverflow;
    body.style.height = previous.bodyHeight;
    body.style.margin = previous.bodyMargin;
    body.style.overscrollBehavior = previous.bodyOverscroll;
    if (root) {
      root.style.height = previous.rootHeight;
      root.style.overflow = previous.rootOverflow;
    }
    if (previous.meta) meta?.setAttribute('content', previous.meta);
  };
}
