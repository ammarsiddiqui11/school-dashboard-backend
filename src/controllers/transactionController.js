const Order = require('../models/Order');
const OrderStatus = require('../models/OrderStatus');
const mongoose = require('mongoose');

/**
 * GET /transactions
 * Supports pagination: ?page=1&limit=10
 * Sorting: ?sort=payment_time&order=desc
 * Filtering via query params: status=success
 */
exports.getAllTransactions = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;
    const sortField = req.query.sort || 'payment_time';
    const sortOrder = (req.query.order === 'asc') ? 1 : -1;
    const statusFilter = req.query.status;

    
    const pipeline = [
      
      {
        $lookup: {
          from: 'orderstatuses', 
          localField: '_id',
          foreignField: 'collect_id',
          as: 'statuses'
        }
      },
      { $unwind: { path: '$statuses', preserveNullAndEmptyArrays: true } },
    ];

    
    if (statusFilter) {
      pipeline.push({
        $match: { 'statuses.status': statusFilter }
      });
    }

    // projection
    pipeline.push({
      $project: {
        collect_id: '$statuses._id',
        order_id: '$_id',
        school_id: 1,
        gateway: '$gateway_name',
        order_amount: '$statuses.order_amount',
        transaction_amount: '$statuses.transaction_amount',
        status: '$statuses.status',
        custom_order_id: '$custom_order_id',
        payment_time: '$statuses.payment_time'
      }
    });

    // sort, paginate
    pipeline.push({ $sort: { [sortField]: sortOrder } });
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });

    const results = await Order.aggregate(pipeline);

    // total count for pagination (separate lightweight count)
    const totalPipeline = [
      {
        $lookup: {
          from: 'orderstatuses',
          localField: '_id',
          foreignField: 'collect_id',
          as: 'statuses'
        }
      },
      { $unwind: { path: '$statuses', preserveNullAndEmptyArrays: true } }
    ];
    if (statusFilter) {
      totalPipeline.push({ $match: { 'statuses.status': statusFilter } });
    }
    totalPipeline.push({ $count: 'total' });
    const totalResult = await Order.aggregate(totalPipeline);
    const total = totalResult[0]?.total || 0;

    res.json({ page, limit, total, data: results });
  } catch (err) {
    next(err);
  }
};

exports.getTransactionsBySchool = async (req, res, next) => {
  try {
    const schoolId = req.params.schoolId;
    const results = await Order.aggregate([
      { $match: { school_id: schoolId } },
      {
        $lookup: {
          from: 'orderstatuses',
          localField: '_id',
          foreignField: 'collect_id',
          as: 'statuses'
        }
      },
      { $unwind: { path: '$statuses', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          collect_id: '$statuses._id',
          school_id: 1,
          gateway: '$gateway_name',
          order_amount: '$statuses.order_amount',
          transaction_amount: '$statuses.transaction_amount',
          status: '$statuses.status',
          custom_order_id: '$custom_order_id',
          payment_time: '$statuses.payment_time'
        }
      }
    ]);
    res.json(results);
  } catch (err) {
    next(err);
  }
};

exports.getTransactionStatus = async (req, res, next) => {
  try {
    const custom_order_id = req.params.custom_order_id;
    if (!custom_order_id) return res.status(400).json({ message: 'custom_order_id required' });

    // find latest OrderStatus by custom_order_id
    const status = await OrderStatus.findOne({ custom_order_id }).sort({ createdAt: -1 });
    if (!status) return res.status(404).json({ message: 'Transaction not found' });
    res.json(status);
  } catch (err) {
    next(err);
  }
};
