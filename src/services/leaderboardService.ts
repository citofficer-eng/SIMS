
import { getApiBase } from '../constants';
import { Team } from '../types';
import { getLeaderboard } from './api';

type LeaderboardCallback = (data: Team[], source: 'sse' | 'poll') => void;

export class LeaderboardSync {
  private sse: EventSource | null = null;
  private pollInterval: number | null = null;
  private callback: LeaderboardCallback | null = null;
  private API_BASE = getApiBase();
  private sseUrl = `${this.API_BASE}/sse/leaderboard.php`;

  subscribe(callback: LeaderboardCallback) {
    this.callback = callback;
    this.startSse();
  }

  unsubscribe() {
    this.stopSse();
    this.stopPolling();
    this.callback = null;
  }

  private startSse() {
    // Only attempt SSE if not using the mock API and it's a real remote URL
    if (this.API_BASE !== '/mock' && this.API_BASE.startsWith('http')) {
        this.sse = new EventSource(this.sseUrl);

        this.sse.onmessage = (event) => {
          try {
            const messageData = JSON.parse(event.data);
            if (messageData.type === 'leaderboard_update' && this.callback) {
              this.callback(messageData.data, 'sse');
            }
          } catch (error) {
            console.error('Error parsing SSE message:', error);
          }
        };

        this.sse.onerror = () => {
          console.warn('SSE connection failed. Falling back to polling.');
          this.sse?.close();
          this.startPolling();
        };
    } else {
        // For mock API or relative paths, polling is more reliable
        this.startPolling();
    }
  }

  private stopSse() {
    if (this.sse) {
      this.sse.close();
      this.sse = null;
    }
  }

  private startPolling() {
    // Don't start a new poll if one is already running
    if (this.pollInterval) return;

    // Initial poll
    this.poll();

    this.pollInterval = window.setInterval(() => this.poll(), 7000);
  }

  private async poll() {
    try {
        // Use the getLeaderboard function which respects the real/mock mode
        const data = await getLeaderboard();
        if (this.callback) {
            this.callback(data, 'poll');
        }
    } catch(error) {
        console.error("Polling failed:", error);
    }
  }

  private stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }
}
