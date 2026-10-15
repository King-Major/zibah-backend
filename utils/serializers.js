// Turns Mongo documents into the snake_case JSON shapes expected by the React
// frontend. Note: `id` fields are now 24-char strings instead of integers.

const idOf = (v) => (v == null ? null : String(v._id ?? v));

const primaryImage = (images) => {
  const list = images || [];
  const primary = list.find((i) => i.isPrimary) || list[0];
  return primary ? primary.url : null;
};

const serializeUser = (u) => ({ id: idOf(u), name: u.name || '', email: u.email, role: u.role });

const serializeCategory = (c) => ({
  id: idOf(c), name: c.name, slug: c.slug, created_at: c.createdAt,
});

const serializeVendor = (v) => ({
  id: idOf(v), name: v.name, email: v.email, company_name: v.companyName, created_at: v.createdAt,
});

const serializeLocation = (l) => ({
  id: idOf(l), name: l.name, address: l.address, added_fee: l.addedFee, created_at: l.createdAt,
});

const serializeProduct = (p, { detailed = false } = {}) => {
  const category = p.category && p.category.name ? p.category : null;
  const vendor = p.vendor && p.vendor.name ? p.vendor : null;
  const out = {
    id: idOf(p),
    category_id: idOf(p.category),
    vendor_id: idOf(p.vendor),
    name: p.name,
    description: p.description,
    price: p.price,
    stock: p.stock,
    is_digital: p.isDigital,
    created_at: p.createdAt,
    category_name: category ? category.name : null,
    category_slug: category ? category.slug : null,
    primary_image: primaryImage(p.images),
  };
  if (detailed) {
    out.vendor_name = vendor ? vendor.name : null;
    out.images = (p.images || []).map((i) => ({ id: idOf(i), url: i.url, is_primary: !!i.isPrimary }));
  }
  return out;
};

const serializeCartItem = (ci) => ({
  id: idOf(ci.product), // product id (the frontend keys the cart by product)
  cart_id: idOf(ci),
  quantity: ci.quantity,
  name: ci.product.name,
  price: ci.product.price,
  primary_image: primaryImage(ci.product.images),
});

const serializeWishlistItem = (w) => ({
  wishlist_id: idOf(w),
  product_id: idOf(w.product),
  name: w.product.name,
  price: w.product.price,
  image_url: primaryImage(w.product.images),
});

const serializeOrder = (o) => ({
  id: idOf(o),
  user_id: idOf(o.user),
  location_id: idOf(o.location),
  subtotal: o.subtotal,
  delivery_fee: o.deliveryFee,
  total_amount: o.totalAmount,
  status: o.status,
  paystack_ref: o.paystackRef,
  paid_at: o.paidAt || null,
  created_at: o.createdAt,
  pickup_location: o.locationSnapshot ? o.locationSnapshot.name : null,
  ...(o.user && o.user.email ? { customer_email: o.user.email } : {}),
  items: (o.items || []).map((i) => ({
    product_id: idOf(i.product),
    name: i.name,
    quantity: i.quantity,
    price_at_purchase: i.priceAtPurchase,
    is_digital: i.isDigital,
    primary_image: i.image || null,
  })),
});

const serializeFeedback = (f) => ({
  id: idOf(f), user_id: idOf(f.user), name: f.name, email: f.email,
  message: f.message, rating: f.rating, created_at: f.createdAt,
});

module.exports = {
  idOf, primaryImage, serializeUser, serializeCategory, serializeVendor, serializeLocation,
  serializeProduct, serializeCartItem, serializeWishlistItem, serializeOrder, serializeFeedback,
};
