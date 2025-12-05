let cart = {};
let productCounter = 0;
let user = null;
let menuData = null;  // Will be loaded dynamically
const MAX_QTY = 10;
const GRIND_LEVELS = [
  {value: "грубый", text: "Грубый (Френч-пресс)"},
  {value: "средний", text: "Средний (Дрип/Пуровер)"},
  {value: "мелкий", text: "Мелкий (Эспрессо/Турка)"}
];

// --- Init Logic ---
async function initWebApp() {
    if (window.Telegram && window.Telegram.WebApp) {
        const tg = window.Telegram.WebApp;
        tg.ready();
        tg.expand(); 

        if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
            user = tg.initDataUnsafe.user;
            const name = user.first_name || user.username || "друг";
            document.getElementById('userName').textContent = `Привет, ${name}! Выберите напитки ☕`;
        } else {
            document.getElementById('userName').textContent = "Выберите напитки ☕";
        }

        const submitBtn = document.getElementById('submitBtn');
        submitBtn.addEventListener('click', handleSubmit);
        
        // Load menu data asynchronously
        try {
            const response = await fetch('menu.json');  // Adjust path if needed (e.g., './data/menu.json')
            if (!response.ok) {
                throw new Error('Failed to load menu data');
            }
            menuData = await response.json();
            renderMenu();
        } catch (error) {
            console.error('Error loading menu:', error);
            // Fallback: Show an error message or use hardcoded data
            document.getElementById('menu').innerHTML = '<p style="color: red; text-align: center;">Ошибка загрузки меню. Попробуйте позже.</p>';
        }
    } else {
        document.getElementById('userName').textContent = "Режим предпросмотра";
        document.getElementById('submitBtn').addEventListener('click', handleSubmit);
        
        // Load menu data (same try-catch as above)
        try {
            const response = await fetch('menu.json');
            if (!response.ok) throw new Error('Failed to load menu data');
            menuData = await response.json();
            renderMenu();
        } catch (error) {
            console.error('Error loading menu:', error);
            document.getElementById('menu').innerHTML = '<p style="color: red; text-align: center;">Ошибка загрузки меню. Попробуйте позже.</p>';
        }
    }
}

function updateButtonState() {
    const hasItems = Object.values(cart).some(item => item.qty > 0);
    const submitBtn = document.getElementById('submitBtn');
    const commentContainer = document.getElementById('commentContainer');

    if(submitBtn) {
        submitBtn.disabled = !hasItems;
        submitBtn.textContent = hasItems ? `Оформить заказ` : "Корзина пуста";
    }
    
    const clearBtn = document.getElementById('clearBtn');
    if(clearBtn) clearBtn.style.display = hasItems ? 'block' : 'none';
    
    // Show comment field only if there are items
    if(commentContainer) commentContainer.style.display = hasItems ? 'block' : 'none';
}

function renderMenu() {
    if (!menuData) return; // Ensure data is loaded

    const menuDiv = document.getElementById('menu');
    menuDiv.innerHTML = '';

    for (const [category, subcats] of Object.entries(menuData)) {
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
              <div class="metaSmall">${product.description || ''}</div>
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
            weight: product.weight, // Weight stored here
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
            if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.showAlert) { 
                window.Telegram.WebApp.showAlert('Пожалуйста, выберите помол перед добавлением.'); 
            } else {
                alert('Пожалуйста, выберите помол.');
            }
            grindSelect.style.borderColor = 'red';
            setTimeout(() => grindSelect.style.borderColor = 'rgba(16,24,40,0.06)', 2000);
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
      document.getElementById('orderComment').value = ''; // Clear comment
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
    let name = 'Гость';
    if (user && user.first_name) name = user.first_name;
    
    const comment = document.getElementById('orderComment').value;

    try {
        let totalWeight = 0;

        const items = Object.values(cart).filter(item => item.qty > 0).map(item => {
            if (item.type === 'ground_coffee' && !item.grind) {
                throw new Error(`Укажите помол для: ${item.name}`);
            }
            
            // Calculate total weight for the order
            const itemWeight = (item.weight || 0) * item.qty;
            totalWeight += itemWeight;

            return {
                name: item.name,
                quantity: item.qty,
                weight: item.weight, // Sending single item weight
                total_item_weight: itemWeight, // Sending total weight for this line item
                price: item.price,
                type: item.type,
                grind_level: item.grind || undefined
            };
        });

        if (items.length === 0) return;

        const data = {
            name,
            user_id: user?.id || null,
            comment: comment, 
            items,
            total_weight: totalWeight, 
            total_price: parseFloat(document.getElementById('total').textContent) || 0
        };

        if (window.Telegram && window.Telegram.WebApp) {
            window.Telegram.WebApp.sendData(JSON.stringify(data));
        }
    } catch (err) {
        if (window.Telegram && window.Telegram.WebApp) {
            window.Telegram.WebApp.showAlert(err.message);
        } else {
            alert(err.message);
        }
    }
}

initWebApp();