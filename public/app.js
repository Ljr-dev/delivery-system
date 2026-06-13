const STORAGE_PRODUCTS = 'delivery_products_v2';
const STORAGE_ORDERS = 'delivery_orders_v2';
const STORAGE_CATEGORIES = 'delivery_categories_v2';

const defaultCategories = [
  { id: 1, name: 'Lanches', icon: '🍔' },
  { id: 2, name: 'Pizzas', icon: '🍕' },
  { id: 3, name: 'Bebidas', icon: '🥤' },
  { id: 4, name: 'Doces', icon: '🧁' }
];

const defaultProducts = [
  { id: 1, name: 'X-Burguer Bacon', price: 29.9, category_id: 1, image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80', description: 'Pão, hambúrguer, bacon, queijo, alface e molho especial.', removable: ['Alface', 'Bacon', 'Queijo', 'Molho especial', 'Tomate', 'Cebola'] },
  { id: 2, name: 'Pizza Calabresa', price: 34.9, category_id: 2, image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=80', description: 'Mussarela, calabresa fatiada, cebola e orégano.', removable: ['Cebola', 'Orégano', 'Mussarela', 'Calabresa'] },
  { id: 3, name: 'Coca-Cola 350ml', price: 6.5, category_id: 3, image: 'https://images.unsplash.com/photo-1581006852262-e4307cf6283a?auto=format&fit=crop&w=900&q=80', description: 'Bebida gelada lata 350ml.', removable: [] },
  { id: 4, name: 'Cupcake Chocolate', price: 12.9, category_id: 4, image: 'https://images.unsplash.com/photo-1614707267537-b85aaf00c4b7?auto=format&fit=crop&w=900&q=80', description: 'Cupcake de chocolate com cobertura cremosa.', removable: ['Cobertura', 'Granulado'] }
];

let selectedCategory = 0;
let cart = [];

const brl = value => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const getData = (key, fallback) => JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
const setData = (key, value) => localStorage.setItem(key, JSON.stringify(value));

function seed() {
  if (!localStorage.getItem(STORAGE_CATEGORIES)) setData(STORAGE_CATEGORIES, defaultCategories);
  if (!localStorage.getItem(STORAGE_PRODUCTS)) setData(STORAGE_PRODUCTS, defaultProducts);
  if (!localStorage.getItem(STORAGE_ORDERS)) setData(STORAGE_ORDERS, []);
}

function renderCategories() {
  const categories = getData(STORAGE_CATEGORIES, defaultCategories);
  document.getElementById('categories').innerHTML = [
    `<button class="category ${selectedCategory === 0 ? 'active' : ''}" onclick="filterCategory(0)"><b>🍽️</b>Todos</button>`,
    ...categories.map(category => `<button class="category ${selectedCategory === category.id ? 'active' : ''}" onclick="filterCategory(${category.id})"><b>${category.icon}</b>${category.name}</button>`)
  ].join('');
}

function renderProducts() {
  const products = getData(STORAGE_PRODUCTS, defaultProducts).filter(product => !selectedCategory || product.category_id === selectedCategory);
  document.getElementById('products').innerHTML = products.map(product => `
    <article class="product">
      <img src="${product.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=80'}" alt="${product.name}">
      <div class="product-content">
        <h3>${product.name}</h3>
        <p>${product.description || ''}</p>
        <div class="price-row">
          <span class="price">${brl(product.price)}</span>
          <button type="button" onclick="addToCart(${product.id})">Adicionar</button>
        </div>
      </div>
    </article>
  `).join('') || '<p>Nenhum produto encontrado.</p>';
}

function filterCategory(id) {
  selectedCategory = id;
  renderCategories();
  renderProducts();
}

function addToCart(id) {
  const product = getData(STORAGE_PRODUCTS, defaultProducts).find(item => item.id === id);
  if (!product) return;
  cart.push({ ...product, cart_id: Date.now() + Math.random(), quantity: 1, removed: [] });
  renderCart();
  openCart();
}

function removeFromCart(cartId) {
  cart = cart.filter(item => item.cart_id !== cartId);
  renderCart();
}

function toggleRemoved(cartId, ingredient, checked) {
  cart = cart.map(item => {
    if (item.cart_id !== cartId) return item;
    const removed = new Set(item.removed || []);
    checked ? removed.add(ingredient) : removed.delete(ingredient);
    return { ...item, removed: [...removed] };
  });
  renderCart(false);
}

function renderCart(rebuild = true) {
  const total = cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  document.getElementById('cartCount').textContent = cart.length;
  if (!rebuild) return;

  document.getElementById('cartItems').innerHTML = cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-top">
        <div>
          <b>${item.quantity}x ${item.name}</b>
          <small>${brl(item.price)}</small>
        </div>
        <strong>${brl(item.price * item.quantity)}</strong>
      </div>
      ${(item.removable || []).length ? `
        <small>Remover do lanche:</small>
        <div class="remove-options">
          ${item.removable.map(ingredient => `
            <label>
              <input type="checkbox" ${item.removed?.includes(ingredient) ? 'checked' : ''} onchange="toggleRemoved(${item.cart_id}, '${ingredient}', this.checked)">
              Sem ${ingredient}
            </label>
          `).join('')}
        </div>
      ` : '<small>Este item não possui ingredientes removíveis.</small>'}
      <button type="button" onclick="removeFromCart(${item.cart_id})">Remover item</button>
    </div>
  `).join('') + `<h3>Total: ${brl(total)}</h3>`;
}

function openCart() { document.getElementById('cart').classList.add('open'); }
function closeCart() { document.getElementById('cart').classList.remove('open'); }

document.getElementById('checkoutForm').addEventListener('submit', event => {
  event.preventDefault();
  if (!cart.length) return alert('Adicione pelo menos um produto.');

  const customer = Object.fromEntries(new FormData(event.currentTarget));
  const orders = getData(STORAGE_ORDERS, []);
  const total = cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  const order = {
    id: orders.length ? Math.max(...orders.map(item => item.id)) + 1 : 1,
    ...customer,
    items: cart.map(item => ({ product_name: item.name, quantity: item.quantity, price: item.price, removed: item.removed || [] })),
    total,
    status: 'confirmado',
    created_at: new Date().toISOString()
  };

  orders.unshift(order);
  setData(STORAGE_ORDERS, orders);
  cart = [];
  event.currentTarget.reset();
  renderCart();
  alert(`Pedido #${order.id} realizado com sucesso!`);
  closeCart();
});

window.filterCategory = filterCategory;
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.toggleRemoved = toggleRemoved;
window.openCart = openCart;
window.closeCart = closeCart;

seed();
renderCategories();
renderProducts();
renderCart();
