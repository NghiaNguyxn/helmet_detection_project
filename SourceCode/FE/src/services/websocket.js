import { API_BASE_URL } from './api';

class WebSocketService {
  constructor() {
    this.ws = null;
    this.listeners = new Set();
    this.statusListeners = new Set();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 3000;
    this.url = API_BASE_URL.replace('http', 'ws') + '/helmet/ws';
    this.status = 'offline'; // 'offline', 'connecting', 'online'
    
    // Session Intelligence (Persist across page changes)
    this.sessionStats = {
      violationCount: 0,
      totalDetections: 0,
      totalConfidence: 0,
      startTime: Date.now()
    };
  }

  resetSessionStats() {
    this.sessionStats = {
      violationCount: 0,
      totalDetections: 0,
      totalConfidence: 0,
      startTime: Date.now()
    };
    this.notifyStatusChange(this.status); // Trigger update
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;

    const token = localStorage.getItem('token');
    const authUrl = token ? `${this.url}?token=${token}` : this.url;

    this.status = 'connecting';
    this.notifyStatusChange('connecting');

    console.log(`Connecting to WebSocket: ${authUrl.split('?')[0]}`);
    this.ws = new WebSocket(authUrl);

    this.ws.onopen = () => {
      console.log('WebSocket Connection Established');
      this.reconnectAttempts = 0;
      this.status = 'online';
      this.notifyStatusChange('online');
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Update Session Intelligence if it's a violation
        if (data.event === 'new_violation') {
          this.sessionStats.violationCount += 1;
          
          // Calculate average confidence for this record
          const detections = data.data.detections || [];
          if (detections.length > 0) {
            const avgConf = detections.reduce((sum, d) => sum + d.confidence, 0) / detections.length;
            this.sessionStats.totalDetections += 1;
            this.sessionStats.totalConfidence += avgConf;
          }
          
          // Notify listeners about the update (using status listeners as a trick or we could add stats listeners)
          this.notifyStatusChange(this.status);
        }
        
        this.listeners.forEach(listener => listener(data));
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    this.ws.onclose = (event) => {
      console.log('WebSocket Connection Closed');
      this.status = 'offline';
      this.notifyStatusChange('offline');
      this.attemptReconnect();
    };

    this.ws.onerror = (err) => {
      console.error('WebSocket Error:', err);
      this.status = 'offline';
      this.notifyStatusChange('offline');
      this.ws.close();
    };
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      setTimeout(() => this.connect(), this.reconnectInterval);
    } else {
      console.warn('Max reconnection attempts reached. Please check your connection.');
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  onStatusChange(callback) {
    this.statusListeners.add(callback);
    callback(this.status);
    return () => this.statusListeners.delete(callback);
  }

  notifyStatusChange(status) {
    this.statusListeners.forEach(callback => callback(status));
  }
}

const socketService = new WebSocketService();
export default socketService;
