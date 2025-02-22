import React, { forwardRef, useRef } from 'react'
import { Dialog } from '@headlessui/react'
import Link from 'next/link'
import clsx from 'clsx'
import { Router, useRouter } from 'next/router'
import { useIsomorphicLayoutEffect } from '~/hooks'
import { Header } from '~/components/layouts'
import { createContext, useEffect, useState } from 'react'

interface NavItemProps extends Partial<Navigation> {
  fallbackHref: string
  isPublished?: boolean
}

const NavItem = forwardRef<HTMLElement, React.PropsWithChildren<NavItemProps>>(
  function NavItem(
    { href, children, isActive, isPublished, fallbackHref },
    ref,
  ) {
    return (
      //@ts-ignore
      <li ref={ref}>
        <Link href={isPublished ? href! : fallbackHref}>
          <a
            className={clsx('block border-l pl-4 -ml-px font-normal text-md', {
              'text-sky-500 border-current dark:text-sky-400 font-semibold':
                isActive,
              'border-transparent hover:border-gray-400 dark:hover:border-gray-500':
                !isActive,
              'text-gray-700 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300':
                !isActive && isPublished,
              'text-gray-400': !isActive && !isPublished,
            })}
          >
            {children}
          </a>
        </Link>
      </li>
    )
  },
)

/**
 * Find the nearst scrollable ancestor (or self if scrollable)
 *
 * Code adapted and simplified from the smoothscroll polyfill
 *
 *
 * @param {Element} el
 */
function nearestScrollableContainer(el?: Element) {
  if (!el) return document.body
  /**
   * indicates if an element can be scrolled
   *
   * @param {Node} el
   */
  function isScrollable(el: Element) {
    const style = window.getComputedStyle(el)
    const overflowX = style['overflowX']
    const overflowY = style['overflowY']
    const canScrollY = el.clientHeight < el.scrollHeight
    const canScrollX = el.clientWidth < el.scrollWidth

    const isScrollableY =
      canScrollY && (overflowY === 'auto' || overflowY === 'scroll')
    const isScrollableX =
      canScrollX && (overflowX === 'auto' || overflowX === 'scroll')

    return isScrollableY || isScrollableX
  }

  while (el !== document.body && isScrollable(el!) === false) {
    // @ts-ignore
    el = el.parentNode || el.host
  }

  return el
}

const isNavigationRecord = (obj: object): obj is Record<string, Navigation[]> =>
  typeof obj === 'object' && obj !== null && !Array.isArray(obj)

interface NavProps {
  nav: Record<string, Navigation[]>
  fallbackHref: string
  mobile?: boolean
}

function Nav({
  nav,
  children,
  fallbackHref,
  mobile = false,
}: React.PropsWithChildren<NavProps>) {
  const router = useRouter()
  const activeItemRef = useRef<HTMLElement | null>(null)
  const previousActiveItemRef = useRef<HTMLElement | null>(null)
  const scrollRef = useRef<HTMLElement | null>(null)

  useIsomorphicLayoutEffect(() => {
    function updatePreviousRef() {
      previousActiveItemRef.current = activeItemRef.current
    }

    if (activeItemRef.current) {
      if (activeItemRef.current === previousActiveItemRef.current) {
        updatePreviousRef()
        return
      }

      updatePreviousRef()

      const scrollable = nearestScrollableContainer(
        scrollRef.current ?? undefined,
      )
      if (!scrollable) return

      const scrollRect = scrollable.getBoundingClientRect()
      const activeItemRect = activeItemRef.current.getBoundingClientRect()

      const top = activeItemRef.current.offsetTop
      const bottom = top - scrollRect.height + activeItemRect.height

      if (scrollable.scrollTop > top || scrollable.scrollTop < bottom) {
        scrollable.scrollTop =
          top - scrollRect.height / 2 + activeItemRect.height / 2
      }
    }
  }, [router.pathname])

  return (
    <nav ref={scrollRef} id="nav" className="lg:text-sm lg:leading-6 relative">
      <ul>
        {children}
        {nav &&
          Object.keys(nav)
            .map((category) => {
              const items = nav[category]
              const nestedMenu = isNavigationRecord(items)
              if (nestedMenu) {
                return (
                  <li key={category} className="mt-12 lg:mt-8">
                    <h5 className="mb-8 lg:mb-3 font-medium text-gray-900 dark:text-gray-200 uppercase">
                      {category}
                    </h5>
                    <ul
                      className={clsx(
                        'block border-l pl-4 -ml-px',
                        'space-y-6 lg:space-y-2 border-l border-gray-100',
                        mobile
                          ? 'dark:border-gray-700'
                          : 'dark:border-gray-800',
                      )}
                    >
                      {Object.keys(items).map((subcategory) => {
                        const publishedSubItems = items[subcategory].filter(
                          (item) => item.published !== false,
                        )
                        if (publishedSubItems.length === 0 && !fallbackHref)
                          return null
                        return (
                          <li key={subcategory} className="mt-12 lg:mt-4">
                            <h6
                              className={clsx(
                                'mb-8 lg:mb-3 font-semibold uppercase',
                                {
                                  'text-gray-350 dark:text-gray-200':
                                    publishedSubItems.length > 0,
                                  'text-gray-400':
                                    publishedSubItems.length === 0,
                                },
                              )}
                            >
                              {subcategory}
                            </h6>
                            <ul
                              className={clsx(
                                'space-y-6 lg:space-y-2 border-l border-gray-100',
                                mobile
                                  ? 'dark:border-gray-700'
                                  : 'dark:border-gray-800',
                              )}
                            >
                              {(fallbackHref
                                ? items[subcategory]
                                : publishedSubItems
                              ).map((item, i) => {
                                let isActive = item.match
                                  ? item.match.test(router.asPath)
                                  : item.href === router.asPath
                                return (
                                  <NavItem
                                    key={i}
                                    href={item.href!}
                                    isActive={isActive}
                                    ref={isActive ? activeItemRef : undefined}
                                    isPublished={item.published !== false}
                                    fallbackHref={fallbackHref}
                                  >
                                    {item.title}
                                  </NavItem>
                                )
                              })}
                            </ul>
                          </li>
                        )
                      })}
                    </ul>
                  </li>
                )
              }
              let publishedItems = items.filter(
                (item) => item.published !== false,
              )
              if (publishedItems.length === 0 && !fallbackHref) return null
              return (
                <li key={category} className="mt-12 lg:mt-8">
                  <h5
                    className={clsx('mb-8 lg:mb-3 font-medium', {
                      'text-gray-900 dark:text-gray-200':
                        publishedItems.length > 0,
                      'text-gray-400': publishedItems.length === 0,
                    })}
                  >
                    {category}
                  </h5>
                  <ul
                    className={clsx(
                      'space-y-6 lg:space-y-2 border-l border-gray-100',
                      mobile ? 'dark:border-gray-700' : 'dark:border-gray-800',
                    )}
                  >
                    {(fallbackHref ? nav[category] : publishedItems).map(
                      (item, i) => {
                        let isActive = item.match
                          ? item.match.test(router.asPath)
                          : item.href === router.asPath
                        return (
                          <NavItem
                            key={i}
                            href={item.href!}
                            isActive={isActive}
                            ref={isActive ? activeItemRef : undefined}
                            isPublished={item.published !== false}
                            fallbackHref={fallbackHref}
                          >
                            {item.title}
                          </NavItem>
                        )
                      },
                    )}
                  </ul>
                </li>
              )
            })
            .filter(Boolean)}
      </ul>
    </nav>
  )
}

interface WrapperProps {
  allowOverflow?: boolean
}

function Wrapper({
  allowOverflow,
  children,
}: React.PropsWithChildren<WrapperProps>) {
  return (
    <div className={allowOverflow ? undefined : 'overflow-hidden'}>
      {children}
    </div>
  )
}

interface Props {
  frontMatter: Dict
  allowOverflow?: boolean
  fallbackHref?: string
  nav: Record<string, Navigation[]>
}

interface ContextProps {
  setNavIsOpen: (isOpen: boolean) => void
  navIsOpen: boolean
  nav: Record<string, Navigation[]>
}

export const DocLayoutContext = createContext<ContextProps>({
  setNavIsOpen: () => {},
  navIsOpen: false,
  nav: {},
})

export default function DocLayout({
  nav,
  frontMatter,
  children,
  allowOverflow,
  fallbackHref = '#',
}: React.PropsWithChildren<Props>) {
  let [navIsOpen, setNavIsOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (!navIsOpen) return
    function handleRouteChange() {
      setNavIsOpen(false)
    }
    Router.events.on('routeChangeComplete', handleRouteChange)
    return () => {
      Router.events.off('routeChangeComplete', handleRouteChange)
    }
  }, [navIsOpen])
  let section =
    frontMatter.section ||
    Object.entries(
      // @ts-ignore
      nav ?? {},
    ).find(([, items]) => {
      if (isNavigationRecord(items)) {
        return Object.entries(items).find(([_, subItems]) =>
          subItems.some((item) => item.href === router.asPath),
        )
      }
      return (items ?? []).find(
        ({ href }: { href: string }) => href === router.asPath,
      )
    })?.[0]
  return (
    <>
      <DocLayoutContext.Provider value={{ nav, navIsOpen, setNavIsOpen }}>
        <Header
          hasNav={true}
          navIsOpen={navIsOpen}
          onNavToggle={(isOpen: boolean) => setNavIsOpen(isOpen)}
          title={frontMatter.title}
          section={frontMatter.section}
        />
        <Wrapper allowOverflow={allowOverflow}>
          <div className="max-w-[90rem] mx-auto px-4 sm:px-6 md:px-8">
            <div className="hidden lg:block fixed z-20 inset-0 top-[3.8125rem] left-[max(0px,calc(50%-45rem))] right-auto w-[19.5rem] pb-10 px-8 overflow-y-auto">
              <Nav nav={nav} fallbackHref={fallbackHref}></Nav>
            </div>
            <div className="lg:pl-[19.5rem]">
              <main
                className={clsx(
                  'prose prose-gray max-w-3xl mx-auto relative z-20 pt-10 xl:max-w-none dark:prose-invert dark:text-gray-400',
                  // headings
                  'prose-headings:scroll-mt-28 prose-headings:font-display prose-headings:font-normal lg:prose-headings:scroll-mt-[8.5rem]',
                  // links
                  'prose-a:font-semibold dark:prose-a:text-sky-400',
                  // link underline
                  'prose-a:no-underline prose-a:shadow-[inset_0_-2px_0_0_var(--tw-prose-background,#fff),inset_0_calc(-1*(var(--tw-prose-underline-size,4px)+2px))_0_0_var(--tw-prose-underline,theme(colors.sky.300))] hover:prose-a:[--tw-prose-underline-size:6px] dark:[--tw-prose-background:theme(colors.gray.900)] dark:prose-a:shadow-[inset_0_calc(-1*var(--tw-prose-underline-size,2px))_0_0_var(--tw-prose-underline,theme(colors.sky.800))] dark:hover:prose-a:[--tw-prose-underline-size:6px]',
                  // pre
                  'prose-pre:rounded-xl prose-pre:bg-gray-900 prose-pre:shadow-lg dark:prose-pre:bg-gray-800/60 dark:prose-pre:shadow-none dark:prose-pre:ring-1 dark:prose-pre:ring-gray-300/10',
                  // hr
                  'dark:prose-hr:border-gray-800',
                )}
              >
                {children}
              </main>
            </div>
          </div>
        </Wrapper>
        <Dialog
          as="div"
          open={navIsOpen}
          onClose={() => setNavIsOpen?.(false)}
          className="fixed z-50 inset-0 overflow-y-auto lg:hidden"
        >
          <Dialog.Overlay className="fixed inset-0 bg-black/20 backdrop-blur-sm dark:bg-gray-900/80" />
          <div className="relative bg-white w-80 max-w-[calc(100%-3rem)] p-6 dark:bg-gray-800">
            <button
              type="button"
              onClick={() => setNavIsOpen?.(false)}
              className="absolute z-10 top-5 right-5 w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-300"
            >
              <span className="sr-only">Close navigation</span>
              <svg viewBox="0 0 10 10" className="w-2.5 h-2.5 overflow-visible">
                <path
                  d="M0 0L10 10M10 0L0 10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <Nav nav={nav} fallbackHref={fallbackHref} mobile={true}></Nav>
          </div>
        </Dialog>
      </DocLayoutContext.Provider>
    </>
  )
}
