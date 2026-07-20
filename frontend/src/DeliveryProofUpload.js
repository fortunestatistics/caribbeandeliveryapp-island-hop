import React, { useState } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Textarea } from './components/ui/textarea';
import { Camera, CheckCircle, Upload } from 'lucide-react';
import { useLocationConsent } from './LocationConsentContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DeliveryProofUpload = ({ orderId, onUploaded }) => {
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [notes, setNotes] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [error, setError] = useState('');
  const { requestLocationConsent } = useLocationConsent();

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please pick an image file');
      return;
    }
    setError('');
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result);
      setPhoto(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const captureLocation = () =>
    new Promise((resolve) => {
      if (!navigator.geolocation) return resolve({});
      requestLocationConsent().then((granted) => {
        if (!granted) return resolve({});
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
          () => resolve({}),
          { timeout: 5000 }
        );
      });
    });

  const handleSubmit = async () => {
    if (!photo) {
      setError('Photo is required');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const loc = await captureLocation();
      await axios.post(
        `${API}/orders/${orderId}/proof`,
        {
          photo_base64: photo,
          notes,
          recipient_name: recipientName,
          ...loc,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setUploaded(true);
      if (onUploaded) onUploaded();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to upload proof');
    } finally {
      setSubmitting(false);
    }
  };

  if (uploaded) {
    return (
      <Card className="border-green-500/30" data-testid="pod-success-card">
        <CardContent className="py-10 text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-foreground">Proof Uploaded</h3>
          <p className="text-muted-foreground mt-2">Order marked as delivered.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="pod-upload-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-gold-500" />
          Proof of Delivery
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Take a photo at the drop-off point to confirm delivery.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="pod-photo">Photo</Label>
          <Input
            id="pod-photo"
            data-testid="pod-photo-input"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="mt-1"
          />
          {photoPreview && (
            <img
              src={photoPreview}
              alt="proof preview"
              data-testid="pod-photo-preview"
              className="mt-3 max-h-64 rounded-lg border border-gold-500/20"
            />
          )}
        </div>
        <div>
          <Label htmlFor="pod-recipient">Recipient Name (optional)</Label>
          <Input
            id="pod-recipient"
            data-testid="pod-recipient-input"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            placeholder="Who received the order?"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="pod-notes">Notes (optional)</Label>
          <Textarea
            id="pod-notes"
            data-testid="pod-notes-input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Left at front door, handed to customer, etc."
            className="mt-1"
          />
        </div>
        {error && <p className="text-sm text-red-500" data-testid="pod-error">{error}</p>}
        <Button
          data-testid="pod-submit-btn"
          onClick={handleSubmit}
          disabled={submitting || !photo}
          className="w-full bg-gold-gradient text-white"
        >
          <Upload className="h-4 w-4 mr-2" />
          {submitting ? 'Uploading…' : 'Confirm Delivery'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default DeliveryProofUpload;
