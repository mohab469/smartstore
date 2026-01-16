const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/users.model');
const { Op } = require('sequelize');

class AuthController {
  // تسجيل مستخدم جديد
  static async register(req, res) {
    try {
      const {
        username,
        email,
        password,
        full_name,
        store_name,
        phone
      } = req.body;

      // التحقق من البيانات
      if (!username || !password || !full_name) {
        return res.status(400).json({
          success: false,
          message: 'اسم المستخدم وكلمة المرور والاسم الكامل مطلوبة'
        });
      }

      // التحقق من عدم تكرار اسم المستخدم
      const existingUser = await User.findOne({
        where: {
          [Op.or]: [
            { username },
            { email }
          ]
        }
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'اسم المستخدم أو البريد الإلكتروني مستخدم بالفعل'
        });
      }

      // تشفير كلمة المرور
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      // إنشاء المستخدم
      const user = await User.create({
        username,
        email,
        password_hash: passwordHash,
        full_name,
        store_name: store_name || 'متجري الذكي',
        phone,
        role: 'owner',
        is_active: true,
        settings: JSON.stringify({
          currency: 'LYD',
          currency_symbol: 'د.ل',
          language: 'ar',
          theme: 'light'
        })
      });

      // إنشاء توكن
      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        process.env.JWT_SECRET || 'smartstore-ai-secret',
        { expiresIn: '7d' }
      );

      res.status(201).json({
        success: true,
        message: 'تم إنشاء الحساب بنجاح',
        data: {
          user: {
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            store_name: user.store_name,
            role: user.role
          },
          token
        }
      });
    } catch (error) {
      console.error('خطأ في التسجيل:', error);
      res.status(500).json({
        success: false,
        message: 'حدث خطأ في التسجيل'
      });
    }
  }

  // تسجيل الدخول
  static async login(req, res) {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: 'اسم المستخدم وكلمة المرور مطلوبان'
        });
      }

      // البحث عن المستخدم
      const user = await User.findOne({
        where: {
          [Op.or]: [
            { username },
            { email: username }
          ],
          is_active: true
        }
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'اسم المستخدم أو كلمة المرور غير صحيحة'
        });
      }

      // التحقق من كلمة المرور
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: 'اسم المستخدم أو كلمة المرور غير صحيحة'
        });
      }

      // إنشاء توكن
      const token = jwt.sign(
        { 
          id: user.id, 
          username: user.username, 
          role: user.role,
          store_name: user.store_name
        },
        process.env.JWT_SECRET || 'smartstore-ai-secret',
        { expiresIn: '7d' }
      );

      // تحديث آخر دخول
      await user.update({ last_login: new Date() });

      res.json({
        success: true,
        message: 'تم تسجيل الدخول بنجاح',
        data: {
          user: {
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            store_name: user.store_name,
            role: user.role,
            settings: user.settings ? JSON.parse(user.settings) : {}
          },
          token
        }
      });
    } catch (error) {
      console.error('خطأ في تسجيل الدخول:', error);
      res.status(500).json({
        success: false,
        message: 'حدث خطأ في تسجيل الدخول'
      });
    }
  }

  // التحقق من التوكن
  static async verifyToken(req, res) {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      
      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'التوكن مطلوب'
        });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'smartstore-ai-secret');
      
      const user = await User.findByPk(decoded.id, {
        attributes: ['id', 'username', 'full_name', 'store_name', 'role', 'settings']
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'المستخدم غير موجود'
        });
      }

      res.json({
        success: true,
        data: {
          user: {
            ...user.toJSON(),
            settings: user.settings ? JSON.parse(user.settings) : {}
          }
        }
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        message: 'توكن غير صالح'
      });
    }
  }

  // تحديث الملف الشخصي
  static async updateProfile(req, res) {
    try {
      const { full_name, store_name, phone, email, settings } = req.body;
      const userId = req.user.id;

      const user = await User.findByPk(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'المستخدم غير موجود'
        });
      }

      // التحقق من البريد الإلكتروني إذا تم تغييره
      if (email && email !== user.email) {
        const existingEmail = await User.findOne({ where: { email } });
        if (existingEmail) {
          return res.status(400).json({
            success: false,
            message: 'البريد الإلكتروني مستخدم بالفعل'
          });
        }
      }

      // تحديث البيانات
      const updates = {};
      if (full_name) updates.full_name = full_name;
      if (store_name) updates.store_name = store_name;
      if (phone) updates.phone = phone;
      if (email) updates.email = email;
      if (settings) {
        const currentSettings = user.settings ? JSON.parse(user.settings) : {};
        updates.settings = JSON.stringify({ ...currentSettings, ...settings });
      }

      await user.update(updates);

      res.json({
        success: true,
        message: 'تم تحديث الملف الشخصي بنجاح',
        data: {
          user: {
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            store_name: user.store_name,
            role: user.role,
            settings: user.settings ? JSON.parse(user.settings) : {}
          }
        }
      });
    } catch (error) {
      console.error('خطأ في تحديث الملف الشخصي:', error);
      res.status(500).json({
        success: false,
        message: 'حدث خطأ في تحديث الملف الشخصي'
      });
    }
  }

  // تغيير كلمة المرور
  static async changePassword(req, res) {
    try {
      const { current_password, new_password } = req.body;
      const userId = req.user.id;

      if (!current_password || !new_password) {
        return res.status(400).json({
          success: false,
          message: 'كلمة المرور الحالية والجديدة مطلوبتان'
        });
      }

      const user = await User.findByPk(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'المستخدم غير موجود'
        });
      }

      // التحقق من كلمة المرور الحالية
      const isValidPassword = await bcrypt.compare(current_password, user.password_hash);
      
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: 'كلمة المرور الحالية غير صحيحة'
        });
      }

      // تشفير كلمة المرور الجديدة
      const salt = await bcrypt.genSalt(10);
      const newPasswordHash = await bcrypt.hash(new_password, salt);

      // تحديث كلمة المرور
      await user.update({ password_hash: newPasswordHash });

      res.json({
        success: true,
        message: 'تم تغيير كلمة المرور بنجاح'
      });
    } catch (error) {
      console.error('خطأ في تغيير كلمة المرور:', error);
      res.status(500).json({
        success: false,
        message: 'حدث خطأ في تغيير كلمة المرور'
      });
    }
  }
}

module.exports = AuthController;