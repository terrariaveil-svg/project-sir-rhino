
const API_URL = "/api";

const productTable = document.getElementById("productTable");
const productForm = document.getElementById("productForm");
const formContainer = document.getElementById("formContainer");
const searchInput = document.getElementById("searchInput");
const message = document.getElementById("message");

let products = [];

async function apiRequest(url, options = {}) {
    let response;

    try {
        response = await fetch(`${API_URL}${url}`, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...options.headers
            }
        });
    } catch {
        const hint = window.location.protocol === "file:"
            ? "Open the app with start.bat, not directly from index.html."
            : "Run start.bat and keep the API window open.";
        throw new Error(`Cannot connect to the inventory server. ${hint}`);
    }

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Something went wrong.");
    }

    return data;
}

function showMessage(text, isError = false) {
    message.textContent = text;
    message.style.color = isError ? "#d33333" : "#16845c";
}

async function loadProducts(search = "") {
    try {
        const query = search
            ? `?search=${encodeURIComponent(search)}`
            : "";

        products = await apiRequest(`/products${query}`);
        displayProducts(products);
        await loadDashboard();
    } catch (error) {
        productTable.innerHTML =
            `<tr><td colspan="7">${escapeHTML(error.message)}</td></tr>`;
        showMessage(error.message, true);
    }
}

function displayProducts(items) {
    if (!items.length) {
        productTable.innerHTML =
            `<tr><td colspan="7">No products found.</td></tr>`;
        return;
    }

    productTable.innerHTML = items.map(product => {
        const quantity = Number(product.quantity);

        let status = "Available";
        let statusClass = "available";

        if (quantity === 0) {
            status = "Out of Stock";
            statusClass = "out";
        } else if (quantity <= 10) {
            status = "Low Stock";
            statusClass = "low";
        }

        return `
            <tr>
                <td>${product.product_id}</td>
                <td>${escapeHTML(product.product_name)}</td>
                <td>${escapeHTML(product.category)}</td>
                <td>₱${Number(product.price).toFixed(2)}</td>
                <td>${quantity}</td>
                <td><span class="badge ${statusClass}">${status}</span></td>
                <td>
                    <button class="edit-btn"
                        onclick="editProduct(${product.product_id})">
                        Edit
                    </button>
                    <button class="delete-btn"
                        onclick="deleteProduct(${product.product_id})">
                        Delete
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

async function loadDashboard() {
    try {
        const data = await apiRequest("/dashboard");

        document.getElementById("totalProducts").textContent =
            data.total_products;

        document.getElementById("totalStock").textContent =
            data.total_stock;

        document.getElementById("inventoryValue").textContent =
            `₱${Number(data.inventory_value).toLocaleString("en-PH", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })}`;

        document.getElementById("lowStock").textContent =
            data.low_stock;
    } catch (error) {
        showMessage(error.message, true);
    }
}

document.getElementById("addButton").addEventListener("click", () => {
    productForm.reset();
    document.getElementById("productId").value = "";
    document.getElementById("formTitle").textContent = "Add New Product";
    document.getElementById("saveButton").textContent = "Save Product";
    formContainer.hidden = false;
});

document.getElementById("cancelButton").addEventListener("click", () => {
    formContainer.hidden = true;
    productForm.reset();
});

productForm.addEventListener("submit", async event => {
    event.preventDefault();

    const id = document.getElementById("productId").value;

    const product = {
        product_name: document.getElementById("productName").value.trim(),
        category: document.getElementById("category").value.trim(),
        price: document.getElementById("price").value,
        quantity: document.getElementById("quantity").value
    };

    try {
        const url = id ? `/products/${id}` : "/products";
        const method = id ? "PUT" : "POST";

        await apiRequest(url, {
            method,
            body: JSON.stringify(product)
        });

        showMessage(id
            ? "Product updated successfully!"
            : "Product added successfully!"
        );

        productForm.reset();
        formContainer.hidden = true;
        await loadProducts(searchInput.value.trim());
    } catch (error) {
        showMessage(error.message, true);
    }
});

async function editProduct(id) {
    try {
        const product = await apiRequest(`/products/${id}`);

        document.getElementById("productId").value = product.product_id;
        document.getElementById("productName").value = product.product_name;
        document.getElementById("category").value = product.category;
        document.getElementById("price").value = product.price;
        document.getElementById("quantity").value = product.quantity;

        document.getElementById("formTitle").textContent = "Edit Product";
        document.getElementById("saveButton").textContent = "Update Product";

        formContainer.hidden = false;
        formContainer.scrollIntoView({ behavior: "smooth" });
    } catch (error) {
        showMessage(error.message, true);
    }
}

async function deleteProduct(id) {
    if (!confirm("Are you sure you want to delete this product?")) {
        return;
    }

    try {
        await apiRequest(`/products/${id}`, {
            method: "DELETE"
        });

        showMessage("Product deleted successfully!");
        await loadProducts(searchInput.value.trim());
    } catch (error) {
        showMessage(error.message, true);
    }
}

let searchTimer;

searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);

    searchTimer = setTimeout(() => {
        loadProducts(searchInput.value.trim());
    }, 300);
});

// Start the application
loadProducts();
