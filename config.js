// API Configuration
const API_BASE_URL = 'https://class1admin-backend.onrender.com/api';

// API endpoints
const API_ENDPOINTS = {
  // Instructors
  INSTRUCTORS: `${API_BASE_URL}/instructors`,
  
  // Students
  STUDENTS: `${API_BASE_URL}/students`,
  NEXT_MEMBER_NUMBER: `${API_BASE_URL}/students/next-member-number`,
  
  // Weekly checks
  WEEKLY: `${API_BASE_URL}/weekly`,
  
  // Monthly checks
  MONTHLY: `${API_BASE_URL}/monthly`,
  
  // Surveys
  SURVEYS: `${API_BASE_URL}/surveys`,
  
  // Auth
  AUTH: `${API_BASE_URL}/auth`,
  
  // Health check
  HEALTH: `${API_BASE_URL}/health`
};

// API utility functions
const api = {
  async get(endpoint) {
    try {
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('API GET error:', error);
      throw error;
    }
  },

  async post(endpoint, data) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('API POST error:', error);
      throw error;
    }
  },

  async put(endpoint, data) {
    try {
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('API PUT error:', error);
      throw error;
    }
  },

  async delete(endpoint) {
    try {
      const response = await fetch(endpoint, {
        method: 'DELETE'
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('API DELETE error:', error);
      throw error;
    }
  }
};

// Export for use in other files
window.API_ENDPOINTS = API_ENDPOINTS;
window.api = api; 