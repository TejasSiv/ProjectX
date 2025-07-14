import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MapPin,
  Route,
  Settings,
  Play,
  Save,
  Upload,
  Download,
  Calculator,
  Wind,
  Gauge,
  Clock,
  Zap,
  AlertTriangle,
  CheckCircle
} from "lucide-react";

interface Waypoint {
  id: string;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  action: "waypoint" | "takeoff" | "land" | "hover" | "photo";
  waitTime?: number;
}

interface MissionPlan {
  id: string;
  name: string;
  orderId?: string;
  waypoints: Waypoint[];
  settings: {
    maxAltitude: number;
    maxSpeed: number;
    homePosition: { lat: number; lon: number; alt: number };
    returnToLaunch: boolean;
    failsafeAltitude: number;
  };
  estimatedDuration: number;
  estimatedDistance: number;
  status: "draft" | "validated" | "uploaded" | "executing";
}

export function MissionPlanningInterface() {
  const [currentMission, setCurrentMission] = useState<MissionPlan>({
    id: "mission-001",
    name: "Delivery Mission - Draft",
    waypoints: [],
    settings: {
      maxAltitude: 50,
      maxSpeed: 15,
      homePosition: { lat: 37.7749, lon: -122.4194, alt: 10 },
      returnToLaunch: true,
      failsafeAltitude: 30
    },
    estimatedDuration: 0,
    estimatedDistance: 0,
    status: "draft"
  });

  const [selectedWaypoint, setSelectedWaypoint] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Calculate mission estimates
  useEffect(() => {
    if (currentMission.waypoints.length < 2) {
      setCurrentMission(prev => ({
        ...prev,
        estimatedDuration: 0,
        estimatedDistance: 0
      }));
      return;
    }

    let totalDistance = 0;
    let totalTime = 0;

    for (let i = 0; i < currentMission.waypoints.length - 1; i++) {
      const wp1 = currentMission.waypoints[i];
      const wp2 = currentMission.waypoints[i + 1];

      // Calculate distance using Haversine formula
      const R = 6371000; // Earth radius in meters
      const lat1Rad = (wp1.latitude * Math.PI) / 180;
      const lat2Rad = (wp2.latitude * Math.PI) / 180;
      const deltaLatRad = ((wp2.latitude - wp1.latitude) * Math.PI) / 180;
      const deltaLonRad = ((wp2.longitude - wp1.longitude) * Math.PI) / 180;

      const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
                Math.cos(lat1Rad) * Math.cos(lat2Rad) *
                Math.sin(deltaLonRad / 2) * Math.sin(deltaLonRad / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;

      // Add altitude difference
      const altDiff = Math.abs(wp2.altitude - wp1.altitude);
      const totalSegmentDistance = Math.sqrt(distance * distance + altDiff * altDiff);

      totalDistance += totalSegmentDistance;

      // Calculate time based on speed
      const avgSpeed = (wp1.speed + wp2.speed) / 2;
      const segmentTime = totalSegmentDistance / avgSpeed;
      totalTime += segmentTime;

      // Add wait time if specified
      if (wp2.waitTime) {
        totalTime += wp2.waitTime;
      }
    }

    setCurrentMission(prev => ({
      ...prev,
      estimatedDuration: totalTime / 60, // Convert to minutes
      estimatedDistance: totalDistance / 1000 // Convert to kilometers
    }));
  }, [currentMission.waypoints]);

  const addWaypoint = () => {
    const newWaypoint: Waypoint = {
      id: `wp-${Date.now()}`,
      latitude: 37.7749 + (Math.random() - 0.5) * 0.01,
      longitude: -122.4194 + (Math.random() - 0.5) * 0.01,
      altitude: 20,
      speed: 10,
      action: "waypoint"
    };

    setCurrentMission(prev => ({
      ...prev,
      waypoints: [...prev.waypoints, newWaypoint]
    }));
  };

  const updateWaypoint = (id: string, updates: Partial<Waypoint>) => {
    setCurrentMission(prev => ({
      ...prev,
      waypoints: prev.waypoints.map(wp => 
        wp.id === id ? { ...wp, ...updates } : wp
      )
    }));
  };

  const removeWaypoint = (id: string) => {
    setCurrentMission(prev => ({
      ...prev,
      waypoints: prev.waypoints.filter(wp => wp.id !== id)
    }));
    if (selectedWaypoint === id) {
      setSelectedWaypoint(null);
    }
  };

  const validateMission = () => {
    const errors: string[] = [];

    if (currentMission.waypoints.length < 2) {
      errors.push("Mission must have at least 2 waypoints");
    }

    currentMission.waypoints.forEach((wp, index) => {
      if (wp.altitude > currentMission.settings.maxAltitude) {
        errors.push(`Waypoint ${index + 1}: Altitude exceeds maximum limit`);
      }
      if (wp.speed > currentMission.settings.maxSpeed) {
        errors.push(`Waypoint ${index + 1}: Speed exceeds maximum limit`);
      }
      if (wp.latitude < -90 || wp.latitude > 90) {
        errors.push(`Waypoint ${index + 1}: Invalid latitude`);
      }
      if (wp.longitude < -180 || wp.longitude > 180) {
        errors.push(`Waypoint ${index + 1}: Invalid longitude`);
      }
    });

    setValidationErrors(errors);
    
    if (errors.length === 0) {
      setCurrentMission(prev => ({ ...prev, status: "validated" }));
    }

    return errors.length === 0;
  };

  const uploadMission = async () => {
    if (!validateMission()) return;

    try {
      setCurrentMission(prev => ({ ...prev, status: "uploaded" }));
      // Here you would make API call to upload mission to backend
      console.log("Uploading mission:", currentMission);
    } catch (error) {
      console.error("Failed to upload mission:", error);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case "takeoff": return "🛫";
      case "land": return "🛬";
      case "hover": return "⏸️";
      case "photo": return "📷";
      default: return "📍";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "validated": return "default";
      case "uploaded": return "default";
      case "executing": return "default";
      case "draft": return "secondary";
      default: return "secondary";
    }
  };

  return (
    <div className="space-y-6">
      {/* Mission Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center space-x-2">
                <Route className="h-5 w-5" />
                <span>{currentMission.name}</span>
              </CardTitle>
              <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                <span>ID: {currentMission.id}</span>
                <Badge variant={getStatusColor(currentMission.status)}>
                  {currentMission.status.toUpperCase()}
                </Badge>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
              <Button 
                onClick={uploadMission}
                disabled={currentMission.status === "executing"}
                className="flex items-center space-x-2"
              >
                <Play className="h-4 w-4" />
                <span>Upload Mission</span>
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Mission Planning */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="waypoints" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="waypoints">Waypoints</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
              <TabsTrigger value="validation">Validation</TabsTrigger>
            </TabsList>

            <TabsContent value="waypoints" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Mission Waypoints</CardTitle>
                    <Button onClick={addWaypoint} size="sm">
                      <MapPin className="h-4 w-4 mr-2" />
                      Add Waypoint
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {currentMission.waypoints.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <MapPin className="h-8 w-8 mx-auto mb-2" />
                        <p>No waypoints added yet</p>
                        <p className="text-sm">Click "Add Waypoint" to start planning your mission</p>
                      </div>
                    ) : (
                      currentMission.waypoints.map((waypoint, index) => (
                        <motion.div
                          key={waypoint.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                            selectedWaypoint === waypoint.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                          }`}
                          onClick={() => setSelectedWaypoint(waypoint.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="text-lg">{getActionIcon(waypoint.action)}</div>
                              <div>
                                <div className="font-medium">
                                  Waypoint {index + 1} - {waypoint.action}
                                </div>
                                <div className="text-sm text-muted-foreground font-mono">
                                  {waypoint.latitude.toFixed(6)}, {waypoint.longitude.toFixed(6)}
                                </div>
                              </div>
                            </div>
                            <div className="text-right text-sm">
                              <div>Alt: {waypoint.altitude}m</div>
                              <div>Speed: {waypoint.speed}m/s</div>
                            </div>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Waypoint Editor */}
              {selectedWaypoint && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Edit Waypoint</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const waypoint = currentMission.waypoints.find(wp => wp.id === selectedWaypoint);
                      if (!waypoint) return null;

                      return (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Latitude</Label>
                            <Input
                              type="number"
                              step="0.000001"
                              value={waypoint.latitude}
                              onChange={(e) => updateWaypoint(waypoint.id, { latitude: parseFloat(e.target.value) })}
                            />
                          </div>
                          <div>
                            <Label>Longitude</Label>
                            <Input
                              type="number"
                              step="0.000001"
                              value={waypoint.longitude}
                              onChange={(e) => updateWaypoint(waypoint.id, { longitude: parseFloat(e.target.value) })}
                            />
                          </div>
                          <div>
                            <Label>Altitude (m)</Label>
                            <Input
                              type="number"
                              value={waypoint.altitude}
                              onChange={(e) => updateWaypoint(waypoint.id, { altitude: parseFloat(e.target.value) })}
                            />
                          </div>
                          <div>
                            <Label>Speed (m/s)</Label>
                            <Input
                              type="number"
                              value={waypoint.speed}
                              onChange={(e) => updateWaypoint(waypoint.id, { speed: parseFloat(e.target.value) })}
                            />
                          </div>
                          <div>
                            <Label>Action</Label>
                            <Select
                              value={waypoint.action}
                              onValueChange={(value) => updateWaypoint(waypoint.id, { action: value as any })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="waypoint">Waypoint</SelectItem>
                                <SelectItem value="takeoff">Takeoff</SelectItem>
                                <SelectItem value="land">Land</SelectItem>
                                <SelectItem value="hover">Hover</SelectItem>
                                <SelectItem value="photo">Take Photo</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-end">
                            <Button
                              variant="destructive"
                              onClick={() => removeWaypoint(waypoint.id)}
                              className="w-full"
                            >
                              Remove Waypoint
                            </Button>
                          </div>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Mission Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label>Maximum Altitude: {currentMission.settings.maxAltitude}m</Label>
                    <Slider
                      value={[currentMission.settings.maxAltitude]}
                      onValueChange={([value]) => 
                        setCurrentMission(prev => ({
                          ...prev,
                          settings: { ...prev.settings, maxAltitude: value }
                        }))
                      }
                      max={100}
                      min={10}
                      step={5}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label>Maximum Speed: {currentMission.settings.maxSpeed}m/s</Label>
                    <Slider
                      value={[currentMission.settings.maxSpeed]}
                      onValueChange={([value]) => 
                        setCurrentMission(prev => ({
                          ...prev,
                          settings: { ...prev.settings, maxSpeed: value }
                        }))
                      }
                      max={30}
                      min={5}
                      step={1}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label>Failsafe Altitude: {currentMission.settings.failsafeAltitude}m</Label>
                    <Slider
                      value={[currentMission.settings.failsafeAltitude]}
                      onValueChange={([value]) => 
                        setCurrentMission(prev => ({
                          ...prev,
                          settings: { ...prev.settings, failsafeAltitude: value }
                        }))
                      }
                      max={100}
                      min={15}
                      step={5}
                      className="mt-2"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="validation" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Mission Validation</CardTitle>
                    <Button onClick={validateMission} variant="outline">
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Validate
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {validationErrors.length === 0 ? (
                    <div className="flex items-center space-x-2 text-green-600">
                      <CheckCircle className="h-5 w-5" />
                      <span>Mission validation passed</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {validationErrors.map((error, index) => (
                        <div key={index} className="flex items-center space-x-2 text-red-600">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="text-sm">{error}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Mission Summary */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center space-x-2">
                <Calculator className="h-5 w-5" />
                <span>Mission Summary</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Waypoints</div>
                  <div className="text-xl font-bold">{currentMission.waypoints.length}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Distance</div>
                  <div className="text-xl font-bold">{currentMission.estimatedDistance.toFixed(2)} km</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Duration</div>
                  <div className="text-xl font-bold">{Math.round(currentMission.estimatedDuration)} min</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Max Alt</div>
                  <div className="text-xl font-bold">{currentMission.settings.maxAltitude} m</div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center space-x-2">
                    <Wind className="h-4 w-4" />
                    <span>Weather</span>
                  </span>
                  <Badge variant="default">Good</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center space-x-2">
                    <Zap className="h-4 w-4" />
                    <span>Battery</span>
                  </span>
                  <Badge variant="default">Sufficient</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center space-x-2">
                    <Settings className="h-4 w-4" />
                    <span>Validation</span>
                  </span>
                  <Badge variant={validationErrors.length === 0 ? "default" : "destructive"}>
                    {validationErrors.length === 0 ? "Passed" : "Failed"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}