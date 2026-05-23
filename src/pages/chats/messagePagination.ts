export function shouldFetchNextMessagesPage(container: Pick<HTMLDivElement, 'scrollHeight' | 'clientHeight'>): boolean {
  return container.scrollHeight <= container.clientHeight;
}
