export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type UploadStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type ModelFormat = 'glb' | 'gltf' | 'obj' | 'fbx' | 'usdz';

export interface Database {
  public: {
    Tables: {
      uploads: {
        Row: {
          id: string;
          user_id: string | null;
          image_url: string;
          status: UploadStatus;
          created_at: string;
          expires_at: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          image_url: string;
          status?: UploadStatus;
          created_at?: string;
          expires_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          image_url?: string;
          status?: UploadStatus;
          created_at?: string;
          expires_at?: string;
        };
      };
      models: {
        Row: {
          id: string;
          upload_id: string;
          model_url: string;
          format: ModelFormat;
          created_at: string;
        };
        Insert: {
          id?: string;
          upload_id: string;
          model_url: string;
          format: ModelFormat;
          created_at?: string;
        };
        Update: {
          id?: string;
          upload_id?: string;
          model_url?: string;
          format?: ModelFormat;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      upload_status: UploadStatus;
      model_format: ModelFormat;
    };
  };
}

// Convenience types
export type Upload = Database['public']['Tables']['uploads']['Row'];
export type NewUpload = Database['public']['Tables']['uploads']['Insert'];
export type Model = Database['public']['Tables']['models']['Row'];
export type NewModel = Database['public']['Tables']['models']['Insert'];

// Upload with related models
export type UploadWithModels = Upload & {
  models: Model[];
};
