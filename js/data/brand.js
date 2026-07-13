// Consola de marca (white-label). En Fase 3 esto llega desde la consola de marca;
// de momento es el contrato de configuración con valores de demo.
export const BRAND = {
  brandId: "maison-demo",
  name: "Maison Demo",
  campaignId: "ss26-bolsos",
  // Plantilla de destino de carrito: {items} = ids separados por coma, {look} = id de look
  cartUrlTemplate: "https://tienda.example.com/cart?add={items}&utm_source=mirrora&utm_campaign={campaign}&look={look}",
  reward: "10% en tu primera compra al guardar un look",
  currency: "EUR",
  retentionDays: 30
};

export function formatPrice(value) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: BRAND.currency }).format(value);
}
