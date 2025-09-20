import axios from 'axios';

const fireflyAPI = axios.create({
  baseURL: '/api/proxy',
});

export default fireflyAPI;
