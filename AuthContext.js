import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

// إنشاء سياق
const AuthContext = createContext({});

// عنوان API
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// مقدم السياق
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [storeInfo, setStoreInfo] = useState(null);

  // إعداد axios
  axios.defaults.headers.common['Authorization'] = token ? `Bearer ${token}` : '';

  // تحقق من صحة التوكن عند التحميل
  useEffect(() => {
    const verifyToken = async () => {
      if (token) {
        try {
          const response = await axios.get(`${API_BASE_URL}/auth/verify`);
          setUser(response.data.data.user);
          setStoreInfo({
            name: response.data.data.user.store_name,
            currency: response.data.data.user.settings?.currency_symbol || 'د.ل'
          });
        } catch (error) {
          console.error('توكن غير صالح:', error);
          logout();
        }
      }
      setLoading(false);
    };

    verifyToken();
  }, [token]);

  // تسجيل الدخول
  const login = async (username, password) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/login`, {
        username,
        password
      });

      const { token, user } = response.data.data;
      
      localStorage.setItem('token', token);
      setToken(token);
      setUser(user);
      setStoreInfo({
        name: user.store_name,
        currency: user.settings?.currency_symbol || 'د.ل'
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'حدث خطأ في تسجيل الدخول'
      };
    }
  };

  // تسجيل الخروج
  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setStoreInfo(null);
  };

  // التسجيل
  const register = async (userData) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/register`, userData);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'حدث خطأ في التسجيل'
      };
    }
  };

  // تحديث الملف الشخصي
  const updateProfile = async (profileData) => {
    try {
      const response = await axios.put(`${API_BASE_URL}/auth/profile`, profileData);
      setUser(response.data.data.user);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'حدث خطأ في التحديث'
      };
    }
  };

  // تغيير كلمة المرور
  const changePassword = async (passwordData) => {
    try {
      const response = await axios.put(`${API_BASE_URL}/auth/change-password`, passwordData);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'حدث خطأ في تغيير كلمة المرور'
      };
    }
  };

  const value = {
    user,
    token,
    loading,
    storeInfo,
    isAuthenticated: !!user,
    login,
    logout,
    register,
    updateProfile,
    changePassword
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// خطاف لاستخدام السياق
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth يجب استخدامه داخل AuthProvider');
  }
  return context;
};