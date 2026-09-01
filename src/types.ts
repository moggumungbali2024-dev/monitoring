export interface Branch {
  id: string;
  name: string;
  location: string;
  manager: string;
  targetOmsetDaily: number;
}

export type CameraLocationType = 'cashier' | 'kitchen' | 'dining' | 'parking' | 'entrance';

export interface Camera {
  id: string;
  branchId: string;
  name: string;
  type: 'Hikvision IP' | 'RTSP Stream' | 'HLS Web Stream' | 'EZVIZ WebRTC' | 'HikConnect Teams';
  ipAddress?: string;
  port?: number;
  channel?: number;
  streamUrl?: string; // Standard RTSP/HLS mock/real stream
  username?: string;
  password?: string;
  status: 'online' | 'offline' | 'connecting';
  locationType: CameraLocationType;
  hikCameraId?: string; // Real camera ID from OpenAPI
  hikDeviceSerial?: string; // Real device serial from OpenAPI
  hikThumbnailUrl?: string; // Real cached pictureURL from OpenAPI
}

export interface OmsetRecord {
  id: string;
  branchId: string;
  date: string; // YYYY-MM-DD
  amount: number; // in IDR
  transactionsCount: number;
  peakHour: string; // e.g., "12:00 - 14:00"
  notes?: string;
}

export interface AIAnalysisRequest {
  branches: Branch[];
  omsetRecords: OmsetRecord[];
  camerasCount: number;
}

export interface AIAnalysisResponse {
  summary: string;
  performanceRank: { branchName: string; totalRevenue: number; performance: string }[];
  recommendations: string[];
  anomalies: string[];
}
