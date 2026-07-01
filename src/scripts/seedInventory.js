// 📁 PATH: src/scripts/seedInventory.js
'use strict';

require('dotenv').config();
const mongoose  = require('mongoose');
const Product   = require('../models/ProductModel');
const Warehouse = require('../models/Warehouse.model');
const Inventory = require('../models/Inventory.model');

const DEFAULT_WAREHOUSES = [
  { name: 'Dhaka Central',  address: '12 Tejgaon Industrial Area', city: 'Dhaka',       country: 'Bangladesh', isActive: true },
  { name: 'Chittagong Port',address: '5 Port Connecting Road',     city: 'Chittagong',  country: 'Bangladesh', isActive: true },
  { name: 'Sylhet Hub',     address: '22 Airport Road',            city: 'Sylhet',      country: 'Bangladesh', isActive: true },
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB');

  let warehouses = await Warehouse.find({});
  if (warehouses.length === 0) {
    warehouses = await Warehouse.insertMany(DEFAULT_WAREHOUSES);
    console.log(`✅ Created ${warehouses.length} warehouses`);
  } else {
    console.log(`ℹ️  Using ${warehouses.length} existing warehouses`);
  }

  const products = await Product.find({}).lean();
  console.log(`ℹ️  Found ${products.length} products`);

  let created = 0;
  for (const product of products) {
    const primaryWarehouse = warehouses[0];

    const rows = product.variants?.length
      ? product.variants.map((v) => ({ sku: v.sku, qty: v.stock }))
      : [{ sku: product.sku, qty: product.stock }];

    for (const row of rows) {
      const exists = await Inventory.findOne({
        productId: product._id, variantSku: row.sku, warehouseId: primaryWarehouse._id,
      });
      if (exists) continue;

      await Inventory.create({
        productId:   product._id,
        variantSku:  row.sku,
        warehouseId: primaryWarehouse._id,
        quantity:    row.qty || 0,
        reserved:    0,
        threshold:   10,
      });
      created += 1;
    }
  }

  console.log(`✅ Created ${created} inventory records`);
  await mongoose.disconnect();
  console.log('✅ Done. Disconnected.');
  process.exit(0);
})().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});