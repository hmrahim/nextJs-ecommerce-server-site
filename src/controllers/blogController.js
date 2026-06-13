// 📁 PATH: controllers/blogController.js


const mongoose = require('mongoose');
const BlogModel = require('../models/BlogModel');

// ─── Helpers ──────────────────────────────────────────────────────────────────
function slugify(text) {
    return text
        .toLowerCase().trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function buildAdminStats(posts) {
    return {
        total: posts.length,
        published: posts.filter((p) => p.status === 'published').length,
        draft: posts.filter((p) => p.status === 'draft').length,
        scheduled: posts.filter((p) => p.status === 'scheduled').length,
        review: posts.filter((p) => p.status === 'review').length,
        archived: posts.filter((p) => p.status === 'archived').length,
        featured: posts.filter((p) => p.isFeatured).length,
        totalViews: posts.reduce((s, p) => s + (p.views || 0), 0),
    };
}

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN — controllers
// ══════════════════════════════════════════════════════════════════════════════

// ─── GET /admin/blogs ─────────────────────────────────────────────────────────
exports.adminGetAll = async (req, res) => {
    try {
        const {
            search,
            category,
            status,
            page = 1,
            limit = 50,
        } = req.query;

        const filter = {};

        if (category) filter.category = category;
        if (status) filter.status = status;

        if (search) {
            filter.$or = [
                { title: { $regex: search, $options: 'i' } },
                { slug: { $regex: search, $options: 'i' } },
                { excerpt: { $regex: search, $options: 'i' } },
                { tags: { $regex: search, $options: 'i' } },
            ];
        }

        const skip = (Number(page) - 1) * Number(limit);
        const total = await BlogModel.countDocuments(filter);

        const posts = await BlogModel.find(filter)
            .populate('author', 'name email avatar')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .lean();

        // stats from ALL posts (no pagination)
        const allPosts = await BlogModel.find({}).select('status isFeatured views').lean();
        const stats = buildAdminStats(allPosts);

        res.status(200).json({
            success: true,
            data: {
                posts,
                stats,
                pagination: {
                    total,
                    page: Number(page),
                    limit: Number(limit),
                    pages: Math.ceil(total / Number(limit)),
                },
            },
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── GET /admin/blogs/stats ───────────────────────────────────────────────────
exports.adminGetStats = async (req, res) => {
    try {
        const posts = await BlogModel.find({}).select('status isFeatured views').lean();
        const stats = buildAdminStats(posts);
        res.status(200).json({ success: true, data: stats });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── GET /admin/blogs/:id ─────────────────────────────────────────────────────
exports.adminGetById = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: 'Invalid blog ID' });
        }
        const post = await BlogModel.findById(req.params.id)
            .populate('author', 'name email avatar')
            .lean();

        if (!post) {
            return res.status(404).json({ success: false, message: 'Blog post not found' });
        }
        res.status(200).json({ success: true, data: post });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── POST /admin/blogs ────────────────────────────────────────────────────────
exports.adminCreate = async (req, res) => {
    console.log(req.body);
    try {
        const {
            title, slug, excerpt, content, category, tags, coverImage,
            authorId, status, isFeatured, readTime, publishedAt,
            metaTitle, metaDescription,
        } = req.body;

        if (!title) {
            return res.status(400).json({ success: false, message: 'Title is required' });
        }

        // Resolve author — use provided or fallback to authenticated admin
        const resolvedAuthor = authorId || req.user?._id;
        if (!resolvedAuthor) {
            return res.status(400).json({ success: false, message: 'Author is required' });
        }

        // Slug: use provided or auto-generate; ensure uniqueness
        let finalSlug = slug ? slug.toLowerCase().trim() : slugify(title);
        const existing = await BlogModel.findOne({ slug: finalSlug }).lean();
        if (existing) {
            finalSlug = `${finalSlug}-${Date.now()}`;
        }

        const post = await BlogModel.create({
            title,
            slug: finalSlug,
            excerpt,
            content,
            category: category || 'news',
            tags: Array.isArray(tags) ? tags : [],
            coverImage: coverImage || { url: '', publicId: '' },
            author: resolvedAuthor,
            status: status || 'draft',
            isFeatured: isFeatured || false,
            readTime: readTime || 5,
            publishedAt: publishedAt || null,
            metaTitle,
            metaDescription,
        });

        const populated = await post.populate('author', 'name email avatar');

        res.status(201).json({ success: true, data: populated });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ success: false, message: 'Slug already exists. Choose a different slug.' });
        }
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── PUT /admin/blogs/:id ─────────────────────────────────────────────────────
exports.adminUpdate = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: 'Invalid blog ID' });
        }

        const {
            title, slug, excerpt, content, category, tags, coverImage,
            authorId, status, isFeatured, readTime, publishedAt,
            metaTitle, metaDescription,
        } = req.body;

        const post = await BlogModel.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ success: false, message: 'Blog post not found' });
        }

        // Slug uniqueness check if changed
        if (slug && slug !== post.slug) {
            const exists = await BlogModel.findOne({ slug, _id: { $ne: post._id } }).lean();
            if (exists) {
                return res.status(400).json({ success: false, message: 'Slug already in use by another post.' });
            }
            post.slug = slug.toLowerCase().trim();
        }

        if (title !== undefined) post.title = title;
        if (excerpt !== undefined) post.excerpt = excerpt;
        if (content !== undefined) post.content = content;
        if (category !== undefined) post.category = category;
        if (tags !== undefined) post.tags = Array.isArray(tags) ? tags : [];
        if (coverImage !== undefined) post.coverImage = coverImage;
        if (authorId !== undefined) post.author = authorId;
        if (status !== undefined) post.status = status;
        if (isFeatured !== undefined) post.isFeatured = isFeatured;
        if (readTime !== undefined) post.readTime = readTime;
        if (publishedAt !== undefined) post.publishedAt = publishedAt;
        if (metaTitle !== undefined) post.metaTitle = metaTitle;
        if (metaDescription !== undefined) post.metaDescription = metaDescription;

        await post.save();
        await post.populate('author', 'name email avatar');

        res.status(200).json({ success: true, data: post });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ success: false, message: 'Slug already exists.' });
        }
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── DELETE /admin/blogs/:id ──────────────────────────────────────────────────
exports.adminDelete = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: 'Invalid blog ID' });
        }
        const post = await BlogModel.findByIdAndDelete(req.params.id);
        if (!post) {
            return res.status(404).json({ success: false, message: 'Blog post not found' });
        }
        res.status(200).json({ success: true, message: 'Blog post deleted successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── DELETE /admin/blogs/bulk ─────────────────────────────────────────────────
exports.adminBulkDelete = async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, message: 'ids array is required' });
        }
        const validIds = ids.filter((id) => mongoose.isValidObjectId(id));
        if (validIds.length === 0) {
            return res.status(400).json({ success: false, message: 'No valid IDs provided' });
        }
        const result = await BlogModel.deleteMany({ _id: { $in: validIds } });
        res.status(200).json({
            success: true,
            message: `${result.deletedCount} post(s) deleted`,
            data: { deletedCount: result.deletedCount },
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── PATCH /admin/blogs/bulk-status ──────────────────────────────────────────
exports.adminBulkStatus = async (req, res) => {
    try {
        const { ids, status } = req.body;
        const validStatuses = ['draft', 'review', 'scheduled', 'published', 'archived'];

        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, message: 'ids array is required' });
        }
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: `status must be one of: ${validStatuses.join(', ')}` });
        }

        const validIds = ids.filter((id) => mongoose.isValidObjectId(id));
        const update = { status };
        if (status === 'published') update.publishedAt = new Date();

        const result = await BlogModel.updateMany(
            { _id: { $in: validIds } },
            { $set: update }
        );

        res.status(200).json({
            success: true,
            message: `${result.modifiedCount} post(s) updated to "${status}"`,
            data: { modifiedCount: result.modifiedCount },
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── PATCH /admin/blogs/:id/toggle-featured ───────────────────────────────────
exports.adminToggleFeatured = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: 'Invalid blog ID' });
        }
        const post = await BlogModel.findById(req.params.id).populate('author', 'name email avatar');
        if (!post) {
            return res.status(404).json({ success: false, message: 'Blog post not found' });
        }
        post.isFeatured = !post.isFeatured;
        await post.save();
        res.status(200).json({ success: true, data: post });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── PATCH /admin/blogs/:id/status ───────────────────────────────────────────
exports.adminChangeStatus = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: 'Invalid blog ID' });
        }
        const { status } = req.body;
        const validStatuses = ['draft', 'review', 'scheduled', 'published', 'archived'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
        }

        const update = { status };
        if (status === 'published') update.publishedAt = new Date();

        const post = await BlogModel.findByIdAndUpdate(
            req.params.id,
            { $set: update },
            { new: true }
        ).populate('author', 'name email avatar');

        if (!post) {
            return res.status(404).json({ success: false, message: 'Blog post not found' });
        }
        res.status(200).json({ success: true, data: post });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ══════════════════════════════════════════════════════════════════════════════
// PUBLIC — controllers
// ══════════════════════════════════════════════════════════════════════════════

// ─── GET /blogs ───────────────────────────────────────────────────────────────
exports.publicGetAll = async (req, res) => {
    try {
        const {
            category,
            tag,
            search,
            page = 1,
            limit = 12,
        } = req.query;

        const filter = { status: 'published' };
        if (category) filter.category = category;
        if (tag) filter.tags = tag;
        if (search) {
            filter.$or = [
                { title: { $regex: search, $options: 'i' } },
                { excerpt: { $regex: search, $options: 'i' } },
                { tags: { $regex: search, $options: 'i' } },
            ];
        }

        const skip = (Number(page) - 1) * Number(limit);
        const total = await BlogModel.countDocuments(filter);

        const posts = await BlogModel.find(filter)
            .populate('author', 'name avatar')
            .select('-content -likedBy -comments -metaDescription')
            .sort({ publishedAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .lean();

        res.status(200).json({
            success: true,
            data: {
                posts,
                pagination: {
                    total,
                    page: Number(page),
                    limit: Number(limit),
                    pages: Math.ceil(total / Number(limit)),
                },
            },
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── GET /blogs/featured ──────────────────────────────────────────────────────
exports.publicGetFeatured = async (req, res) => {
    try {
        const posts = await BlogModel.find({ status: 'published', isFeatured: true })
            .populate('author', 'name avatar')
            .select('-content -likedBy -comments')
            .sort({ publishedAt: -1 })
            .limit(6)
            .lean();

        res.status(200).json({ success: true, data: posts });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── GET /blogs/category/:category ───────────────────────────────────────────
exports.publicGetByCategory = async (req, res) => {
    try {
        const { page = 1, limit = 12 } = req.query;
        const filter = { status: 'published', category: req.params.category };
        const skip = (Number(page) - 1) * Number(limit);
        const total = await BlogModel.countDocuments(filter);

        const posts = await BlogModel.find(filter)
            .populate('author', 'name avatar')
            .select('-content -likedBy -comments')
            .sort({ publishedAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .lean();

        res.status(200).json({
            success: true,
            data: {
                posts,
                pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
            },
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── GET /blogs/:slug ─────────────────────────────────────────────────────────
exports.publicGetBySlug = async (req, res) => {
    try {
        const post = await BlogModel.findOne({ slug: req.params.slug, status: 'published' })
            .populate('author', 'name avatar bio')
            .populate('comments.user', 'name avatar')
            .lean();

        if (!post) {
            return res.status(404).json({ success: false, message: 'Blog post not found' });
        }
        res.status(200).json({ success: true, data: post });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── PATCH /blogs/:id/view ────────────────────────────────────────────────────
exports.trackView = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: 'Invalid blog ID' });
        }
        await BlogModel.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });
        res.status(200).json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── PATCH /blogs/:id/like ────────────────────────────────────────────────────
exports.likePost = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: 'Invalid blog ID' });
        }
        const userId = req.user?._id;
        const post = await BlogModel.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ success: false, message: 'Blog post not found' });
        }

        const alreadyLiked = post.likedBy.includes(userId);
        if (alreadyLiked) {
            post.likedBy.pull(userId);
            post.likes = Math.max(0, post.likes - 1);
        } else {
            post.likedBy.push(userId);
            post.likes += 1;
        }
        await post.save();

        res.status(200).json({
            success: true,
            data: { liked: !alreadyLiked, likesCount: post.likes },
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─── POST /blogs/:id/comments ─────────────────────────────────────────────────
exports.addComment = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: 'Invalid blog ID' });
        }
        const { content } = req.body;
        if (!content || content.trim().length < 3) {
            return res.status(400).json({ success: false, message: 'Comment must be at least 3 characters' });
        }

        const post = await BlogModel.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ success: false, message: 'Blog post not found' });
        }

        post.comments.push({ user: req.user._id, content: content.trim() });
        await post.save();
        await post.populate('comments.user', 'name avatar');

        const newComment = post.comments[post.comments.length - 1];
        res.status(201).json({ success: true, data: newComment });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
