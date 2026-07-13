// Single source of truth for business-type-aware terminology & category taxonomies.
// Used by the merchant dashboard, product/catalog manager, settings, and the
// customer-facing storefront/search so each business shows options that match
// the services it actually provides (restaurants get menu options, pharmacies
// get pharmacy categories, car rentals get vehicle classes, etc.).

export const BUSINESS_TYPE_CONFIG = {
  restaurant: {
    key: 'restaurant',
    customerLabel: 'Restaurant',
    itemNoun: 'Menu Item',
    itemNounPlural: 'Menu Items',
    catalogLabel: 'Menu',
    manageLabel: 'Manage Menu',
    manageRoute: '/menu-management',
    showCuisine: true,
    itemIcon: '🍽️',
    addLabel: 'Add to Cart',
    searchPlaceholder: 'Search menu items…',
    heroCta: null,
    categories: [
      'Appetizers', 'Main Course', 'Desserts', 'Beverages', 'Sides',
      'Specials', 'Breakfast', 'Lunch', 'Dinner', 'Seafood', 'Vegetarian', 'Vegan',
    ],
  },
  pharmacy: {
    key: 'pharmacy',
    customerLabel: 'Pharmacy',
    itemNoun: 'Product',
    itemNounPlural: 'Products',
    catalogLabel: 'Catalog',
    manageLabel: 'Manage Products',
    manageRoute: '/merchant/products',
    showCuisine: false,
    itemIcon: '💊',
    addLabel: 'Add to Cart',
    searchPlaceholder: 'Search medicines & products…',
    heroCta: { title: 'Have a prescription?', subtitle: 'Upload your Rx and we\u2019ll get it filled and delivered.', label: 'Upload Prescription', route: '/pharmacy-order' },
    categories: [
      'Prescription', 'Over-the-Counter', 'Vitamins & Supplements',
      'Personal Care', 'Baby Care', 'First Aid', 'Medical Devices',
    ],
  },
  grocery: {
    key: 'grocery',
    customerLabel: 'Grocery',
    itemNoun: 'Product',
    itemNounPlural: 'Products',
    catalogLabel: 'Catalog',
    manageLabel: 'Manage Products',
    manageRoute: '/merchant/products',
    showCuisine: false,
    itemIcon: '🛒',
    addLabel: 'Add to Cart',
    searchPlaceholder: 'Search groceries…',
    heroCta: { title: 'Fresh groceries, delivered', subtitle: 'Shop by aisle below and we\u2019ll bring it to your door.', label: null, route: null },
    categories: [
      'Fresh Produce', 'Dairy & Eggs', 'Meat & Seafood', 'Bakery', 'Frozen Foods',
      'Beverages', 'Household', 'Pantry', 'Personal Care',
    ],
  },
  car_rental: {
    key: 'car_rental',
    customerLabel: 'Car Rental',
    itemNoun: 'Vehicle',
    itemNounPlural: 'Vehicles',
    catalogLabel: 'Fleet',
    manageLabel: 'Manage Fleet',
    manageRoute: '/merchant/products',
    showCuisine: false,
    itemIcon: '🚗',
    addLabel: 'Reserve',
    searchPlaceholder: 'Search our fleet…',
    heroCta: { title: 'Book your ride', subtitle: 'Browse the fleet and reserve by the day.', label: null, route: null },
    categories: ['Economy', 'Sedan', 'SUV', 'Van', 'Luxury', 'Truck'],
  },
  business: {
    key: 'business',
    customerLabel: 'Retail',
    itemNoun: 'Product',
    itemNounPlural: 'Products',
    catalogLabel: 'Catalog',
    manageLabel: 'Manage Products',
    manageRoute: '/merchant/products',
    showCuisine: false,
    itemIcon: '🛍️',
    addLabel: 'Add to Cart',
    searchPlaceholder: 'Search products…',
    heroCta: null,
    categories: [
      'Food & Beverages', 'Health & Beauty', 'Electronics', 'Clothing',
      'Home & Garden', 'Sports', 'Toys', 'Books', 'Automotive',
      'Pet Supplies', 'Office Supplies',
    ],
  },
};

// Resolve a business/vendor type string to its config, defaulting to general retail.
export const getBusinessConfig = (type) =>
  BUSINESS_TYPE_CONFIG[type] || BUSINESS_TYPE_CONFIG.business;
