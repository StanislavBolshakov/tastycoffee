let cart = {};
let productCounter = 0;
let menuData = null;

const MAX_QTY = 10;
const GRIND_LEVELS = [
  {value: "грубый", text: "Грубый (Френч/Дрип/Пуровер)"},
  {value: "средний", text: "Средний (Эспрессо)"},
  {value: "мелкий", text: "Мелкий (Турка)"}
];

const SCROLL_THRESHOLD = 300;
const BORDER_RESET_DELAY = 2000;

function displayMetadata() {
    const metadata = menuData?.metadata;
    if (!metadata) return;

    const metadataDiv = document.getElementById('menuMetadata');
    const updatedAt = document.getElementById('updatedAt');
    
    if (metadata.updated_at) {
        const date = new Date(metadata.updated_at);
        const options = { 
            day: '2-digit', 
            month: 'short', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        updatedAt.textContent = date.toLocaleDateString('ru-RU', options);
    }
    
    metadataDiv.style.display = 'block';
}

async function initWebApp() {
    if (window.Telegram?.WebApp) {
        const tg = window.Telegram.WebApp;
        tg.ready();
        tg.expand();
    }

    document.getElementById('submitBtn').addEventListener('click', handleSubmit);
    await loadMenuData();
}

async function loadMenuData() {
    try {
        const response = await fetch('https://stanislavbolshakov.github.io/tastycoffee/menu.json');
        if (!response.ok) {
            throw new Error('Failed to load menu data');
        }
        menuData = await response.json();
        displayMetadata();
        renderMenu();
    } catch (error) {
        console.error('Error loading menu:', error);
        document.getElementById('menu').innerHTML = `<p style="color: red; text-align: center;">Ошибка загрузки меню. Попробуйте позже.<br><small style="font-size:11px;">${error.message}</small></p>`;
    }
}

function updateButtonState() {
    const hasItems = Object.values(cart).some(item => item.qty > 0);
    const submitBtn = document.getElementById('submitBtn');
    const commentContainer = document.getElementById('commentContainer');
    const clearBtn = document.getElementById('clearBtn');

    if (submitBtn) {
        submitBtn.disabled = !hasItems;
        submitBtn.textContent = hasItems ? `Оформить заказ` : "Корзина пуста";
    }
    
    if (clearBtn) clearBtn.style.display = hasItems ? 'block' : 'none';
    if (commentContainer) commentContainer.style.display = hasItems ? 'block' : 'none';
}

function renderMenu() {
    if (!menuData) return;

    const menuDiv = document.getElementById('menu');
    menuDiv.innerHTML = '';

    const dataToRender = menuData.data || menuData;

    for (const [category, subcats] of Object.entries(dataToRender)) {
      const catDetails = document.createElement('details');
      const catSummary = document.createElement('summary');
      catSummary.textContent = category;
      catDetails.appendChild(catSummary);
      
      for (const [subcat, products] of Object.entries(subcats)) {
        const subDetails = document.createElement('details');
        const subSummary = document.createElement('summary');
        subSummary.textContent = subcat;
        subDetails.appendChild(subSummary);
        
        products.forEach(product => {
          const prodId = `prod_${productCounter++}`;
          const prodDiv = document.createElement('div');
          prodDiv.className = 'product';

          const discountHtml = product.discount > 0 ?
            `<span class="original-price">${product.price_original} ₽</span><span style="color:var(--muted);margin-left:4px;font-size:12px">-${product.discount}%</span>` : '';

          prodDiv.innerHTML = `
            <div class="left">
              <h4>${product.name} - ${product.weight}г</h4>
            </div>
            <div class="right">
              <div style="display:flex;align-items:center;gap:8px">
                <div class="price">${product.price_final} ₽ ${discountHtml}</div>
              </div>
              ${product.type === 'ground_coffee' ?
                `<div class="grind-select"><select id="grind_${prodId}">
                  <option value="">Выберите помол...</option>
                  ${GRIND_LEVELS.map(level => `<option value="${level.value}">${level.text}</option>`).join('')}
                </select></div>` : ''
              }
              <div class="quantity">
                <button type="button" onclick="changeQty('${prodId}', -1)">-</button>
                <span id="qty_${prodId}">0</span>
                <button type="button" onclick="changeQty('${prodId}', 1)">+</button>
              </div>
            </div>
          `;

          subDetails.appendChild(prodDiv);

          cart[prodId] = {
            qty: 0,
            grind: '',
            name: product.name,
            price: product.price_final,
            weight: product.weight,
            type: product.type
          };

          const grindSelect = prodDiv.querySelector(`#grind_${prodId}`);
          if (grindSelect) {
            grindSelect.addEventListener('change', (e) => {
              cart[prodId].grind = e.target.value;
              if (cart[prodId].qty > 0) updateCart(); 
            });
          }
        });

        catDetails.appendChild(subDetails);
      }

      menuDiv.appendChild(catDetails);
    }

    updateButtonState();
}

window.changeQty = function(prodId, delta) {
    const item = cart[prodId];
    if (!item) return;

    if (delta > 0 && item.type === 'ground_coffee') {
        const grindSelect = document.querySelector(`#grind_${prodId}`);
        if (grindSelect && !grindSelect.value) {
            if (window.Telegram?.WebApp?.showAlert) { 
                window.Telegram.WebApp.showAlert('Пожалуйста, выберите помол перед добавлением.'); 
            } else {
                alert('Пожалуйста, выберите помол.');
            }
            grindSelect.style.borderColor = 'red';
            setTimeout(() => grindSelect.style.borderColor = 'rgba(16,24,40,0.06)', BORDER_RESET_DELAY);
            return;
        }
    }

    const newQty = Math.max(0, Math.min(MAX_QTY, item.qty + delta));

    if (newQty !== item.qty) {
        item.qty = newQty;
        document.getElementById(`qty_${prodId}`).textContent = newQty;
        updateCart();
    }
};

window.clearCart = function() {
    if (confirm("Очистить корзину?")) {
      Object.keys(cart).forEach(prodId => {
        cart[prodId].qty = 0;
        cart[prodId].grind = '';
        
        const qtySpan = document.getElementById(`qty_${prodId}`);
        if (qtySpan) qtySpan.textContent = 0;
        
        const grindSelect = document.querySelector(`#grind_${prodId}`);
        if (grindSelect) grindSelect.value = '';
      });
      updateCart();
      document.getElementById('orderComment').value = '';
    }
};

function updateCart() {
    const cartList = document.getElementById('cart_list');
    const totalSpan = document.getElementById('total');
    cartList.innerHTML = '';
    let total = 0;
    
    Object.entries(cart).forEach(([id, item]) => {
      if (item.qty > 0) {
        const li = document.createElement('li');
        li.className = 'cart-item';
        const grindText = item.grind ? ` (${item.grind})` : '';
        li.innerHTML = `<span>${item.name} x${item.qty}${grindText}</span><span>${item.price * item.qty} ₽</span>`;
        cartList.appendChild(li);
        total += item.price * item.qty;
      }
    });
    
    totalSpan.textContent = total;
    updateButtonState();
}

function handleSubmit() {
    const comment = document.getElementById('orderComment').value;

    try {
        let totalWeight = 0;

        const items = Object.values(cart).filter(item => item.qty > 0).map(item => {
            if (item.type === 'ground_coffee' && !item.grind) {
                throw new Error(`Укажите помол для: ${item.name}`);
            }
            
            const itemWeight = (item.weight || 0) * item.qty;
            totalWeight += itemWeight;

            return {
                name: item.name,
                quantity: item.qty,
                weight: item.weight,
                total_item_weight: itemWeight,
                price: item.price,
                type: item.type,
                grind_level: item.grind || undefined
            };
        });

        if (items.length === 0) return;

        const data = {
            name: 'Гость',
            comment: comment, 
            items,
            total_weight: totalWeight, 
            total_price: parseFloat(document.getElementById('total').textContent) || 0
        };

        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.sendData(JSON.stringify(data));
        }
    } catch (err) {
        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.showAlert(err.message);
        } else {
            alert(err.message);
        }
    }
}

window.scrollToTop = function() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
};

window.addEventListener('scroll', function() {
    const backToTopBtn = document.getElementById('backToTop');
    if (!backToTopBtn) return;
    
    if (window.scrollY > SCROLL_THRESHOLD) {
        backToTopBtn.style.display = 'flex';
    } else {
        backToTopBtn.style.display = 'none';
    }
});

initWebApp();
