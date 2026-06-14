
const mongoose = require('mongoose');
const Product = require('../../models/ProductModel');
const Category = require('../../models/CategoryModel'); 
const ProductVariantModel = require('../../models/ProductVariantModel');


exports.getAllProducts = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            sort = '-createdAt',
            status,
            isActive,
            categoryId,
            brandId,
            search,
        } = req.query;

        const filter = {};

        if (status) filter.status = status;
        if (isActive !== undefined) filter.isActive = isActive === 'true';
        if (categoryId) filter.category = categoryId; // ✅ fixed
        if (brandId) filter.brand = brandId;    // ✅ fixed
        if (search) filter.$text = { $search: search.trim() };

        const skip = (Number(page) - 1) * Number(limit);
        const total = await Product.countDocuments(filter);

        const products = await Product.find(filter)
            .populate('category', 'name slug')      // ✅ schema field name
            .populate('subCategory', 'name slug')
            .populate('subSubCategory', 'name slug')
            
            .sort(sort)
            .skip(skip)
            .limit(Number(limit))
            .lean({ virtuals: true });

        res.status(200).json({
            success: true,
            total,
            page: Number(page),
            pages: Math.ceil(total / Number(limit)),
            results: products,
        });

    } catch (err) {
        console.error('admin.getAllProducts:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/* ─────────────────────────────────────────────
   @desc    Get single product by ID (full detail)
   @route   GET /api/admin/products/:id
   @access  Admin
───────────────────────────────────────────── */
exports.getProductById = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: 'Invalid product ID' });
        }

        const product = await Product.findById(req.params.id)
            .populate('category', 'name slug')
            .populate('subCategory', 'name slug')
            .populate('subSubCategory', 'name slug')
            .lean({ virtuals: true });

        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        // Fetch variants separately (lean() এ virtual populate কাজ করে না)
        const variants = await ProductVariantModel.find({
            product: product._id,
            isActive: true,
        }).sort({ sortOrder: 1 }).lean();

        product.variants = variants;

        res.status(200).json({ success: true, data: product });
    } catch (err) {
        console.error('admin.getProductById:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/* ─────────────────────────────────────────────
   @desc    Create a new product
   @route   POST /api/admin/products
   @access  Admin
   @body    All Product schema fields
───────────────────────────────────────────── */
exports.createProduct = async (req, res) => {
    try {
        const body = req.body;

        /* ── required field validation ── */
        const missing = [];
        if (!body.name?.trim()) missing.push('name');
        if (!body.sku?.trim()) missing.push('sku');
        if (!body.category) missing.push('category');
        if (body.basePrice === undefined || body.basePrice === '') missing.push('basePrice');

        if (missing.length) {
            return res.status(400).json({
                success: false,
                message: `Missing required fields: ${missing.join(', ')}`,
            });
        }

        if (isNaN(Number(body.basePrice)) || Number(body.basePrice) < 0) {
            return res.status(400).json({ success: false, message: 'basePrice must be a non-negative number' });
        }

        /* ── duplicate SKU check ── */
        const skuUpper = body.sku.trim().toUpperCase();
        const exists = await Product.findOne({ sku: skuUpper }).lean();
        if (exists) {
            return res.status(409).json({ success: false, message: `SKU "${skuUpper}" already exists` });
        }

        /* ── sanitize + build ── */
        const fields = {
            name: body.name.trim(),
            ...(body.slug?.trim() && { slug: body.slug.trim() }),
            sku: skuUpper,

            price: Number(body.basePrice),
            comparePrice: body.comparePrice != null && body.comparePrice !== '' ? Number(body.comparePrice) : null,
            cost: body.cost != null && body.cost !== '' ? Number(body.cost) : null,

            stock: body.stock !== undefined && body.stock !== '' ? Number(body.stock) : 0,
            trackInventory: body.trackInventory !== undefined ? Boolean(body.trackInventory) : true,

            description: body.description || '',
            shortDescription: body.shortDescription || '',

            category: body.category,
            subCategory: body.subCategory || null,
            subSubCategory: body.subSubCategory || null,
            brand: body.brand || null,

            tags: Array.isArray(body.tags) ? body.tags : [],
            status: ['active', 'draft', 'archived'].includes(body.status) ? body.status : 'draft',
            featured: Boolean(body.featured),

            weight: body.weight != null && body.weight !== '' ? Number(body.weight) : null,
            dimensions: {
                length: body.dimensions?.length != null && body.dimensions.length !== '' ? Number(body.dimensions.length) : null,
                width: body.dimensions?.width != null && body.dimensions.width !== '' ? Number(body.dimensions.width) : null,
                height: body.dimensions?.height != null && body.dimensions.height !== '' ? Number(body.dimensions.height) : null,
            },

            images: Array.isArray(body.images)
                ? body.images
                    .filter(img => img?.url)
                    .map(img => ({ url: img.url, publicId: img.publicId ?? null }))
                : [],

            discounts: Array.isArray(body.discounts)
                ? body.discounts
                    .filter(d => d?.minQty != null && d?.discount != null)
                    .map(d => ({
                        minQty: Number(d.minQty),
                        discount: Number(d.discount),
                        type: ['percent', 'fixed'].includes(d.type) ? d.type : 'percent',
                    }))
                : [],
        };

        const product = await Product.create(fields);

        return res.status(201).json({ success: true, data: product });

    } catch (err) {
        if (err.code === 11000) {
            const field = Object.keys(err.keyPattern)[0];
            return res.status(409).json({ success: false, message: `Duplicate value for field: ${field}` });
        }
        if (err.name === 'ValidationError') {
            const errors = Object.values(err.errors).map(e => e.message);
            return res.status(422).json({ success: false, message: 'Validation failed', errors });
        }
        console.error('admin.createProduct:', err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};


/* ─────────────────────────────────────────────
   @desc    Update a product
   @route   PUT /api/admin/products/:id
   @access  Admin
   @body    Any subset of Product schema fields
───────────────────────────────────────────── */
exports.updateProduct = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: 'Invalid product ID' });
        }

        /* ── prevent changing SKU to an existing one ── */
        if (req.body.sku) {
            const conflict = await Product.findOne({
                sku: req.body.sku.toUpperCase(),
                _id: { $ne: req.params.id },
            }).lean();
            if (conflict) {
                return res.status(409).json({ success: false, message: `SKU "${req.body.sku}" already in use` });
            }
        }

        /* ── never overwrite variants from the product form ──
           Variants are managed exclusively by /admin/products/:id/variants endpoints.
           Including `variants: []` in $set would wipe the embedded array each save. */
        const updatePayload = { ...req.body };
        delete updatePayload.variants;
        // If the product already has variants, ignore manual `stock` edits
        // (stock is derived from sum of variant stocks via syncProductVariants).


        const existing = await Product.findById(req.params.id).select('variants').lean();
        if (existing?.variants?.length) delete updatePayload.stock;

        const updated = await Product.findByIdAndUpdate(
            req.params.id,
            { $set: updatePayload },
            { new: true, runValidators: true }
        )
            .populate('category', 'name slug')
            

        if (!updated) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        res.status(200).json({ success: true, data: updated });
    } catch (err) {
        if (err.code === 11000) {
            const field = Object.keys(err.keyPattern)[0];
            return res.status(409).json({ success: false, message: `Duplicate value for field: ${field}` });
        }
        if (err.name === 'ValidationError') {
            const errors = Object.values(err.errors).map((e) => e.message);
            return res.status(422).json({ success: false, message: 'Validation failed', errors });
        }
        console.error('admin.updateProduct:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/* ─────────────────────────────────────────────
   @desc    Soft-delete a product (isActive = false, status = archived)
   @route   DELETE /api/admin/products/:id
   @access  Admin
───────────────────────────────────────────── */
exports.deleteProduct = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: 'Invalid product ID' });
        }

        const product = await Product.findByIdAndUpdate(
            req.params.id,
            { $set: { isActive: false, status: 'archived' } },
            { new: true }
        );

        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        res.status(200).json({ success: true, message: 'Product archived (soft deleted)', data: product });
    } catch (err) {
        console.error('admin.deleteProduct:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/* ─────────────────────────────────────────────
   @desc    Hard-delete a product permanently
   @route   DELETE /api/admin/products/:id/hard
   @access  Admin (super-admin recommended)
───────────────────────────────────────────── */
exports.hardDeleteProduct = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: 'Invalid product ID' });
        }

        const product = await Product.findByIdAndDelete(req.params.id);

        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        res.status(200).json({ success: true, message: 'Product permanently deleted' });
    } catch (err) {
        console.error('admin.hardDeleteProduct:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/* ─────────────────────────────────────────────
   @desc    Update product status only
   @route   PATCH /api/admin/products/:id/status
   @access  Admin
   @body    { status: 'active' | 'draft' | 'archived' }
───────────────────────────────────────────── */
exports.updateStatus = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: 'Invalid product ID' });
        }

        const { status } = req.body;
        const allowed = ['active', 'draft', 'archived'];

        if (!allowed.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `status must be one of: ${allowed.join(', ')}`,
            });
        }

        const product = await Product.findByIdAndUpdate(
            req.params.id,
            { $set: { status, isActive: status === 'active' } },
            { new: true }
        );

        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        res.status(200).json({ success: true, data: product });
    } catch (err) {
        console.error('admin.updateStatus:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/* ─────────────────────────────────────────────
   @desc    Update stock for a product (or a specific variant)
   @route   PATCH /api/admin/products/:id/stock
   @access  Admin
   @body    { stock: Number, variantId?: String }
───────────────────────────────────────────── */
exports.updateStock = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: 'Invalid product ID' });
        }

        const { stock, variantId } = req.body;

        if (stock === undefined || stock < 0) {
            return res.status(400).json({ success: false, message: 'stock must be a non-negative number' });
        }

        let update;

        if (variantId) {
            /* update a specific variant's stock */
            if (!mongoose.isValidObjectId(variantId)) {
                return res.status(400).json({ success: false, message: 'Invalid variantId' });
            }
            update = {
                $set: { 'variants.$[v].stock': stock },
            };
        } else {
            /* update top-level stock */
            update = { $set: { stock } };
        }

        const options = variantId
            ? { new: true, arrayFilters: [{ 'v._id': new mongoose.Types.ObjectId(variantId) }] }
            : { new: true };

        const product = await Product.findByIdAndUpdate(req.params.id, update, options);

        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        res.status(200).json({ success: true, data: product });
    } catch (err) {
        console.error('admin.updateStock:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
