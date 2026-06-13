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

const statuses = ['confirmado', 'preparo', 'entrega', 'entregue', 'cancelado'];
const statsEl = document.getElementById('stats');
const ordersEl = document.getElementById('orders');
const productsEl = document.getElementById('products');
const productFormEl = document.getElementById('productForm');
const categorySelectEl = document.getElementById('categorySelect');

const brl = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const getData = (key, fallback) => JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
const setData = (key, value) => localStorage.setItem(key, JSON.stringify(value));

function seed() {
  if (!localStorage.getItem(STORAGE_CATEGORIES)) setData(STORAGE_CATEGORIES, defaultCategories);
  if (!localStorage.getItem(STORAGE_PRODUCTS)) setData(STORAGE_PRODUCTS, defaultProducts);
  if (!localStorage.getItem(STORAGE_ORDERS)) setData(STORAGE_ORDERS, []);
}

function loadAdmin() {
  const categories = getData(STORAGE_CATEGORIES, defaultCategories);
  const products = getData(STORAGE_PRODUCTS, defaultProducts);
  const orders = getData(STORAGE_ORDERS, []);

  const today = new Date().toLocaleDateString('pt-BR');
  const ordersToday = orders.filter(order => new Date(order.created_at).toLocaleDateString('pt-BR') === today);
  const revenue = orders
    .filter(order => order.status !== 'cancelado')
    .reduce((sum, order) => sum + Number(order.total || 0), 0);
  const activeDeliveries = orders.filter(order => ['confirmado', 'preparo', 'entrega'].includes(order.status)).length;

  statsEl.innerHTML = `
    <div class="stat"><span>Pedidos hoje</span><b>${ordersToday.length}</b></div>
    <div class="stat"><span>Faturamento</span><b>${brl(revenue)}</b></div>
    <div class="stat"><span>Entregas ativas</span><b>${activeDeliveries}</b></div>
    <div class="stat"><span>Produtos</span><b>${products.length}</b></div>
  `;

  categorySelectEl.innerHTML = categories
    .map(category => `<option value="${category.id}">${category.icon} ${category.name}</option>`)
    .join('');

  ordersEl.innerHTML = orders.map(order => `
    <div class="order">
      <div>
        <b>#${order.id} ${order.customer_name}</b>
        <small>${new Date(order.created_at).toLocaleString('pt-BR')} - ${order.phone}</small>
        <small>${order.address}</small>
        <small>${order.items.map(item => `${item.quantity}x ${item.product_name}`).join(', ')}</small>
        ${order.items.map(item => item.removed?.length ? `<em>${item.product_name}: sem ${item.removed.join(', ')}</em>` : '').join('')}
        <strong>${brl(order.total)} - ${order.payment_method}</strong>
      </div>
      <select onchange="statusOrder(${order.id}, this.value)">
        ${statuses.map(status => `<option value="${status}" ${order.status === status ? 'selected' : ''}>${status}</option>`).join('')}
      </select>
    </div>
  `).join('') || '<p class="empty">Nenhum pedido ainda. Faça um pedido pela loja pública.</p>';

  productsEl.innerHTML = products.map(product => {
    const category = categories.find(item => item.id === Number(product.category_id));
    return `
      <div class="product-row">
        <div>
          <b>${product.name}</b>
          <small>${category?.name || 'Sem categoria'} - ${brl(product.price)}</small>
          <small>Removíveis: ${(product.removable || []).join(', ') || 'nenhum'}</small>
        </div>
        <div class="actions">
          <button type="button" onclick="editProduct(${product.id})">Editar</button>
          <button type="button" class="danger" onclick="deleteProduct(${product.id})">Excluir</button>
        </div>
      </div>
    `;
  }).join('') || '<p class="empty">Nenhum produto cadastrado.</p>';
}

function statusOrder(id, status) {
  const orders = getData(STORAGE_ORDERS, []);
  setData(STORAGE_ORDERS, orders.map(order => order.id === id ? { ...order, status } : order));
  loadAdmin();
}

function deleteProduct(id) {
  if (!confirm('Excluir este produto do cardápio?')) return;
  const products = getData(STORAGE_PRODUCTS, defaultProducts).filter(product => product.id !== id);
  setData(STORAGE_PRODUCTS, products);
  loadAdmin();
}

function editProduct(id) {
  const products = getData(STORAGE_PRODUCTS, defaultProducts);
  const product = products.find(item => item.id === id);
  if (!product) return;

  productFormEl.name.value = product.name;
  productFormEl.price.value = String(product.price).replace('.', ',');
  productFormEl.category_id.value = product.category_id;
  productFormEl.image.value = product.image || '';
  productFormEl.description.value = product.description || '';
  productFormEl.removable.value = (product.removable || []).join(', ');
  productFormEl.dataset.editing = id;
  productFormEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

productFormEl.addEventListener('submit', event => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  const products = getData(STORAGE_PRODUCTS, defaultProducts);
  const editingId = Number(form.dataset.editing || 0);
  const normalizedProduct = {
    id: editingId || (products.length ? Math.max(...products.map(product => product.id)) + 1 : 1),
    name: data.name.trim(),
    price: Number(String(data.price).replace(',', '.')),
    category_id: Number(data.category_id),
    image: data.image.trim(),
    description: data.description.trim(),
    removable: data.removable.split(',').map(item => item.trim()).filter(Boolean)
  };

  if (!normalizedProduct.name || Number.isNaN(normalizedProduct.price)) {
    alert('Preencha nome e preço corretamente.');
    return;
  }

  const nextProducts = editingId
    ? products.map(product => product.id === editingId ? normalizedProduct : product)
    : [normalizedProduct, ...products];

  setData(STORAGE_PRODUCTS, nextProducts);
  form.reset();
  delete form.dataset.editing;
  loadAdmin();
  alert(editingId ? 'Produto atualizado.' : 'Produto salvo.');
});

function resetDemo() {
  if (!confirm('Resetar produtos, categorias e pedidos da demo?')) return;
  localStorage.removeItem(STORAGE_PRODUCTS);
  localStorage.removeItem(STORAGE_CATEGORIES);
  localStorage.removeItem(STORAGE_ORDERS);
  seed();
  loadAdmin();
}

window.statusOrder = statusOrder;
window.deleteProduct = deleteProduct;
window.editProduct = editProduct;
window.resetDemo = resetDemo;

seed();
loadAdmin();
