import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { cn } from './ui/utils';
import { ProductBrand } from './ProductBrand';
import { PRODUCTS, productUrl, type Product } from '@/lib/products';

const cardClasses = 'flex flex-col gap-0.5 rounded-lg p-3 text-left';

function ProductCard({ product, isCurrent }: { product: Product; isCurrent: boolean }) {
  const Icon = product.icon;
  const url = isCurrent ? null : productUrl(product);

  const body = (
    <>
      <span className="flex items-center gap-2 text-base font-medium text-foreground">
        <Icon className="h-4 w-4 shrink-0" />
        {product.label}
      </span>
      <span className="text-sm text-muted-foreground">{product.description}</span>
    </>
  );

  // Unreleased, or a host with no derivable sibling: shown but not navigable.
  if (!url) {
    return (
      <div
        className={cn(cardClasses, isCurrent ? 'bg-muted' : 'opacity-60')}
        aria-current={isCurrent ? 'page' : undefined}
        aria-disabled={isCurrent ? undefined : true}
        data-testid={`product-${product.id}`}
      >
        {body}
      </div>
    );
  }

  return (
    <a
      href={url}
      className={cn(cardClasses, 'transition-colors hover:bg-muted')}
      data-testid={`product-${product.id}`}
    >
      {body}
    </a>
  );
}

export function ProductSwitcher({ currentProductId }: { currentProductId: string }) {
  const current = PRODUCTS.find((product) => product.id === currentProductId) ?? PRODUCTS[0];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center rounded-lg px-1 py-1 transition-colors hover:bg-muted"
          data-testid="product-switcher-trigger"
        >
          <ProductBrand product={current.label.toLowerCase()} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="grid w-auto grid-cols-2 gap-1 rounded-xl p-2 shadow-lg">
        {PRODUCTS.map((product) => (
          <ProductCard key={product.id} product={product} isCurrent={product.id === current.id} />
        ))}
      </PopoverContent>
    </Popover>
  );
}
