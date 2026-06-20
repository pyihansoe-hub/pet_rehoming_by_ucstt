// js/pages/browse.js - Browse Pets Page Logic

let currentFilters = {
    type: '',
    fee_type: '',
    gender: '',
    city: '',
    search: '',
    page: 1,
    limit: 20
};

async function renderBrowse() {
    const mainContent = document.getElementById('main-content');
    
    // Get URL params for initial filters
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('type')) currentFilters.type = urlParams.get('type');

    mainContent.innerHTML = `
        <div class="container mt-lg">
            <h1>Browse Pets</h1>
            
            <!-- Filters Section -->
            <div class="card mb-lg">
                <form id="filter-form" class="grid grid-4 gap-md">
                    <div class="form-group">
                        <label class="form-label">Search</label>
                        <input type="text" id="filter-search" class="form-input" placeholder="Name or breed...">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Type</label>
                        <select id="filter-type" class="form-select">
                            <option value="">All Types</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Fee Type</label>
                        <select id="filter-fee" class="form-select">
                            <option value="">Any</option>
                            <option value="free">Free</option>
                            <option value="paid">Paid</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Gender</label>
                        <select id="filter-gender" class="form-select">
                            <option value="">Any</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>                            <option value="unknown">Unknown</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">City</label>
                        <select id="filter-city" class="form-select">
                            <option value="">All Cities</option>
                        </select>
                    </div>
                    <div class="form-group flex-center">
                        <button type="submit" class="btn btn-primary" style="width: 100%;">Apply Filters</button>
                    </div>
                </form>
            </div>

            <!-- Results Section -->
            <div id="pets-grid" class="grid grid-4">
                <div class="flex-center" style="grid-column: 1/-1; min-height: 200px;">
                    <div class="spinner"></div>
                </div>
            </div>

            <!-- Pagination -->
            <div id="pagination" class="flex-center mt-lg gap-sm"></div>
        </div>
    `;

    // Load filter options
    loadFilterOptions();

    // Set initial values from state
    document.getElementById('filter-search').value = currentFilters.search;
    document.getElementById('filter-type').value = currentFilters.type;
    document.getElementById('filter-fee').value = currentFilters.fee_type;
    document.getElementById('filter-gender').value = currentFilters.gender;
    document.getElementById('filter-city').value = currentFilters.city;

    // Event listeners
    document.getElementById('filter-form').addEventListener('submit', handleFilterSubmit);
    
    // Initial load
    loadPets();
}

async function loadFilterOptions() {
    try {
        const [types, cities] = await Promise.all([
            API.getPetTypes(),
            API.getCities()
        ]);
        const typeSelect = document.getElementById('filter-type');
        types.forEach(type => {
            const option = document.createElement('option');
            option.value = type.id;
            option.textContent = type.name;
            typeSelect.appendChild(option);
        });

        const citySelect = document.getElementById('filter-city');
        cities.forEach(city => {
            const option = document.createElement('option');
            option.value = city;
            option.textContent = city;
            citySelect.appendChild(option);
        });
    } catch (error) {
        console.error('Failed to load filters:', error);
    }
}

async function loadPets() {
    const grid = document.getElementById('pets-grid');
    grid.innerHTML = '<div class="flex-center" style="grid-column: 1/-1;"><div class="spinner"></div></div>';

    try {
        const data = await API.getPets(currentFilters);
        
        if (data.pets.length === 0) {
            grid.innerHTML = '<div class="flex-center" style="grid-column: 1/-1;"><p>No pets found matching your criteria.</p></div>';
            document.getElementById('pagination').innerHTML = '';
            return;
        }

        grid.innerHTML = data.pets.map(pet => renderPetCard(pet)).join('');
        renderPagination(data.total, data.page, data.limit);
    } catch (error) {
        grid.innerHTML = '<div class="flex-center" style="grid-column: 1/-1;"><p>Failed to load pets.</p></div>';
    }
}

function handleFilterSubmit(e) {
    e.preventDefault();
    currentFilters.search = document.getElementById('filter-search').value;
    currentFilters.type = document.getElementById('filter-type').value;
    currentFilters.fee_type = document.getElementById('filter-fee').value;
    currentFilters.gender = document.getElementById('filter-gender').value;
    currentFilters.city = document.getElementById('filter-city').value;
    currentFilters.page = 1; // Reset to page 1 on new filter
    loadPets();}

function renderPagination(total, currentPage, limit) {
    const totalPages = Math.ceil(total / limit);
    const container = document.getElementById('pagination');
    
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = '';
    
    // Previous button
    html += `<button class="btn btn-sm btn-outline" ${currentPage === 1 ? 'disabled' : ''} onclick="changePage(${currentPage - 1})">Prev</button>`;
    
    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            html += `<button class="btn btn-sm ${i === currentPage ? 'btn-primary' : 'btn-outline'}" onclick="changePage(${i})">${i}</button>`;
        } else if (i === currentPage - 2 || i === currentPage + 2) {
            html += `<span>...</span>`;
        }
    }
    
    // Next button
    html += `<button class="btn btn-sm btn-outline" ${currentPage === totalPages ? 'disabled' : ''} onclick="changePage(${currentPage + 1})">Next</button>`;
    
    container.innerHTML = html;
}

function changePage(page) {
    currentFilters.page = page;
    loadPets();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}