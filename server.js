const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DELIVERY_FEE = 5;
const DB_FILE = path.join(__dirname, 'data', 'delivery.json');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'troque-essa-chave',
  resave: false,
  saveUninitialized: false
}));
app.use(express.static(path.join(__dirname, 'public')));

function parseMoney(value) {
  if (typeof value === 'string') value = value.replace(',', '.');
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function nowIso() {
  return new Date().toISOString();
}

function createSeed() {
  return {
    admins: [
      { id: 1, name: 'Admin', email: 'admin@delivery.com', password_hash: bcrypt.hashSync('123456', 10) }
    ],
    categories: [
      { id: 1, name: 'Lanches', icon: '🍔', active: 1 },
      { id: 2, name: 'Pizzas', icon: '🍕', active: 1 },
      { id: 3, name: 'Bebidas', icon: '🥤', active: 1 },
      { id: 4, name: 'Doces', icon: '🧁', active: 1 }
    ],
    products: [
      { id: 1, category_id: 1, name: 'X-Burguer Bacon', description: 'Pão, hambúrguer, bacon, queijo, alface e molho especial.', price: 29.90, image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=900', active: 1 },
      { id: 2, category_id: 2, name: 'Pizza Calabresa', description: 'Mussarela, calabresa fatiada e orégano.', price: 34.90, image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=900', active: 1 },
      { id: 3, category_id: 3, name: 'Coca-Cola 350ml', description: 'Bebida gelada lata 350ml.', price: 6.50, image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=900', active: 1 },
      { id: 4, category_id: 4, name: 'Cupcake Chocolate', description: 'Massa fofinha com cobertura cremosa.', price: 12.90, image: 'https://images.unsplash.com/photo-1486427944299-d1955d23e34d?w=900', active: 1 }
    ],
    orders: [],
    order_items: [],
    counters: { admins: 2, categories: 5, products: 5, orders: 1, order_items: 1 }
  };
}

function loadDb() {
  if (!fs.existsSync(DB_FILE)) {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    const seed = createSeed();
    fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2));
    return seed;
  }

  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

let db = loadDb();

function saveDb() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function nextId(collection) {
  const id = db.counters[collection] || 1;
  db.counters[collection] = id + 1;
  return id;
}

function activeCategories() {
  return db.categories.filter(category => category.active).sort((a, b) => a.id - b.id);
}

function activeProducts() {
  return db.products
    .filter(product => product.active)
    .map(product => ({ ...product, category: db.categories.find(category => category.id === product.category_id)?.name || '' }))
    .sort((a, b) => b.id - a.id);
}

function mapOrder(order) {
  return {
    ...order,
    items: db.order_items.filter(item => item.order_id === order.id)
      .map(({ product_name, quantity, unit_price, subtotal }) => ({ product_name, quantity, unit_price, subtotal }))
  };
}

const auth = (req, res, next) => {
  if (req.session.admin) return next();
  return res.status(401).json({ error: 'Não autorizado' });
};

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const admin = db.admins.find(entry => entry.email === email);
  if (!admin || !bcrypt.compareSync(password || '', admin.password_hash)) {
    return res.status(401).json({ error: 'Login inválido' });
  }

  req.session.admin = { id: admin.id, name: admin.name, email: admin.email };
  return res.json({ admin: req.session.admin });
});

app.post('/api/logout', (req, res) => req.session.destroy(() => res.json({ ok: true })));
app.get('/api/me', (req, res) => res.json({ admin: req.session.admin || null }));
app.get('/api/categories', (req, res) => res.json(activeCategories()));
app.get('/api/products', (req, res) => res.json(activeProducts()));

app.post('/api/orders', (req, res) => {
  const { customer_name, phone, address, payment_method, items } = req.body;
  if (!customer_name || !phone || !address || !payment_method || !Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: 'Dados incompletos' });
  }

  const products = activeProducts();
  let subtotal = 0;
  const mapped = [];

  for (const item of items) {
    const product = products.find(entry => entry.id === Number(item.product_id));
    if (!product) return res.status(400).json({ error: 'Produto inválido' });

    const quantity = Math.min(99, Math.max(1, Number.parseInt(item.quantity || 1, 10)));
    const itemSubtotal = product.price * quantity;
    subtotal += itemSubtotal;
    mapped.push({ product_id: product.id, product_name: product.name, quantity, unit_price: product.price, subtotal: itemSubtotal });
  }

  const order = {
    id: nextId('orders'),
    customer_name: customer_name.trim(),
    phone: phone.trim(),
    address: address.trim(),
    payment_method,
    delivery_fee: DELIVERY_FEE,
    total: subtotal + DELIVERY_FEE,
    status: 'confirmado',
    created_at: nowIso()
  };

  db.orders.push(order);
  mapped.forEach(item => db.order_items.push({ id: nextId('order_items'), order_id: order.id, ...item }));
  saveDb();

  return res.json({ id: order.id, total: order.total, status: order.status });
});

app.get('/api/admin/categories', auth, (req, res) => {
  res.json(activeCategories().sort((a, b) => a.name.localeCompare(b.name)));
});

app.get('/api/admin/products', auth, (req, res) => res.json(activeProducts()));

app.get('/api/admin/orders', auth, (req, res) => {
  res.json([...db.orders].sort((a, b) => b.id - a.id).slice(0, 100).map(mapOrder));
});

app.get('/api/admin/dashboard', auth, (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const todaysOrders = db.orders.filter(order => order.created_at.slice(0, 10) === today);
  const active = db.orders.filter(order => ['confirmado', 'preparo', 'entrega'].includes(order.status)).length;
  res.json({
    pedidosHoje: todaysOrders.length,
    faturamento: todaysOrders.reduce((sum, order) => sum + order.total, 0),
    entregasAtivas: active,
    produtos: db.products.filter(product => product.active).length
  });
});

app.post('/api/admin/orders/:id/status', auth, (req, res) => {
  const allowed = ['confirmado', 'preparo', 'entrega', 'entregue', 'cancelado'];
  if (!allowed.includes(req.body.status)) return res.status(400).json({ error: 'Status inválido' });

  const order = db.orders.find(entry => entry.id === Number(req.params.id));
  if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });
  order.status = req.body.status;
  saveDb();
  return res.json({ ok: true });
});

app.post('/api/admin/products', auth, (req, res) => {
  const { category_id, name, description, price, image } = req.body;
  const parsedPrice = parseMoney(price);
  if (!name || parsedPrice <= 0) return res.status(400).json({ error: 'Informe nome e preço válido' });

  db.products.push({
    id: nextId('products'),
    category_id: Number(category_id),
    name: name.trim(),
    description: description || '',
    price: parsedPrice,
    image: image || '',
    active: 1
  });
  saveDb();
  return res.json({ ok: true });
});

app.delete('/api/admin/products/:id', auth, (req, res) => {
  const product = db.products.find(entry => entry.id === Number(req.params.id));
  if (!product) return res.status(404).json({ error: 'Produto não encontrado' });
  product.active = 0;
  saveDb();
  res.json({ ok: true });
});

app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public/admin/index.html')));
app.listen(PORT, () => console.log(`Delivery rodando em http://localhost:${PORT}`));
