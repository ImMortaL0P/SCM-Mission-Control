import React, { useState, useEffect, useRef, useCallback } from 'react';

const L = window.L;
const Chart = window.Chart;
const XLSX = window.XLSX;
        

        // --- HAVERSINE DISTANCE CALCULATOR ---
        const haversineDistance = (lat1, lon1, lat2, lon2) => {
            const R = 6371; // Earth's radius in km
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = 
                Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
                Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            return R * c;
        };

        // --- SCM BASELINE LOGISTICS TRANSIT TIMES (from PDF & OSRM) ---
        const SCM_BASELINES = {
            "Kolkata, WB": { distance: 592.0, baselineHours: 18.7 },
            "Ranchi, JH": { distance: 322.0, baselineHours: 14.5 },
            "Bhubaneswar, OD": { distance: 787.0, baselineHours: 34.4 },
            "Siliguri, WB": { distance: 530.0, baselineHours: 17.6 },
            "Guwahati, AS": { distance: 906.0, baselineHours: 37.7 },
            "Jamshedpur, JH": { distance: 444.7, baselineHours: 16.9 },
            "Patna, BR": { distance: 0.0, baselineHours: 0.0 },
            "Gaya, BR": { distance: 105.0, baselineHours: 10.5 },
            "Muzaffarpur, BR": { distance: 95.0, baselineHours: 10.0 },
            "Bhagalpur, BR": { distance: 241.0, baselineHours: 12.6 },
            "Dhanbad, JH": { distance: 318.6, baselineHours: 14.4 },
            "Cuttack, OD": { distance: 766.1, baselineHours: 34.0 },
            "Asansol, WB": { distance: 371.8, baselineHours: 15.1 },
            "Durgapur, WB": { distance: 413.5, baselineHours: 15.9 },
            "Darbhanga, BR": { distance: 129.5, baselineHours: 10.4 },
            "Hazaribagh, JH": { distance: 229.2, baselineHours: 12.6 },
            "Kharagpur, WB": { distance: 592.6, baselineHours: 19.3 },
            "Shillong, ML": { distance: 939.5, baselineHours: 38.5 },
            "Puri, OD": { distance: 843.2, baselineHours: 35.6 }
        };

        // --- MOCK LOGISTICS DATA STORES ---
        const centralWarehouse = { name: "Patna HQ DC", lat: 25.5941, lon: 85.1376 };

        // Helper to generate ETA based on order date and delay minutes
        const generateETA = (orderDate, delayMins) => {
            try {
                const date = new Date(orderDate + "T12:00:00");
                date.setMinutes(date.getMinutes() + delayMins);
                const resMonth = date.toLocaleString('en-US', { month: 'short' });
                const resDay = date.getDate();
                let resHour = date.getHours();
                const resMin = String(date.getMinutes()).padStart(2, '0');
                const resAmpm = resHour >= 12 ? 'PM' : 'AM';
                resHour = resHour % 12;
                if (resHour === 0) resHour = 12;
                return `${resMonth} ${resDay}, ${String(resHour).padStart(2, '0')}:${resMin} ${resAmpm}`;
            } catch (e) {
                return "May 23, 05:00 PM";
            }
        };


        // --- SYSTEM SUB-COMPONENTS ---
        const Sidebar = ({ activeTab, setActiveTab, theme, toggleTheme }) => (
            <div className="w-64 bg-panelBg border-r border-borderSlate flex flex-col justify-between shrink-0 select-none">
                <div>
                    <div className="p-5 flex items-center gap-3 border-b border-borderSlate">
                        <div className="w-8 h-8 rounded-lg bg-brandBlue flex items-center justify-center text-white font-black text-lg">L</div>
                        <div>
                            <h1 className="text-sm font-bold tracking-wider text-white">Supply Chain Monitor</h1>
                            <p className="text-[10px] text-slate-400 font-semibold">MISSION CONTROL</p>
                        </div>
                    </div>
                    <nav className="p-3 space-y-1 text-xs font-medium text-slate-400">
                        <div 
                            onClick={() => setActiveTab("overview")}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition ${activeTab === "overview" ? "bg-brandBlue/10 text-brandBlue font-bold" : "hover:bg-slate-800/50 hover:text-white"}`}
                        >
                            <i className="fa-solid fa-chart-pie text-sm"></i> Overview
                        </div>
                        <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-800/50 hover:text-white rounded-lg cursor-pointer transition opacity-50 cursor-not-allowed" onClick={() => alert("Under Development. Please use Overview or Weather.")}><i className="fa-solid fa-map-location-dot text-sm"></i> Map View</div>
                        <div 
                            onClick={() => setActiveTab("locations")}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition ${activeTab === "locations" ? "bg-brandBlue/10 text-brandBlue font-bold" : "hover:bg-slate-800/50 hover:text-white"}`}
                        >
                            <i className="fa-solid fa-warehouse text-sm"></i> Network Locations
                        </div>
                        <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-800/50 hover:text-white rounded-lg cursor-pointer transition opacity-50 cursor-not-allowed" onClick={() => alert("Under Development. Please use Overview or Weather.")}><i className="fa-solid fa-truck text-sm"></i> Deliveries</div>
                        <div className="flex items-center justify-between px-3 py-2.5 hover:bg-slate-800/50 hover:text-white rounded-lg cursor-pointer transition opacity-50 cursor-not-allowed" onClick={() => alert("Under Development. Please use Overview or Weather.")}>
                            <span className="flex items-center gap-3"><i className="fa-solid fa-bell text-sm"></i> Alerts</span>
                            <span className="bg-statusRed text-white font-bold text-[9px] px-1.5 py-0.5 rounded-full">12</span>
                        </div>
                        <div 
                            onClick={() => setActiveTab("weather")}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition ${activeTab === "weather" ? "bg-brandBlue/10 text-brandBlue font-bold" : "hover:bg-slate-800/50 hover:text-white"}`}
                        >
                            <i className="fa-solid fa-cloud-bolt text-sm"></i> Weather
                        </div>
                        <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-800/50 hover:text-white rounded-lg cursor-pointer transition opacity-50 cursor-not-allowed" onClick={() => alert("Under Development. Please use Overview or Weather.")}><i className="fa-solid fa-newspaper text-sm"></i> News & Disruptions</div>
                        <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-800/50 hover:text-white rounded-lg cursor-pointer transition opacity-50 cursor-not-allowed" onClick={() => alert("Under Development. Please use Overview or Weather.")}><i className="fa-solid fa-route text-sm"></i> Routes & Optimization</div>
                    </nav>
                </div>
                
                <div className="p-4 border-t border-borderSlate space-y-4">
                    {/* Theme Toggle Button */}
                    <div className="flex items-center justify-between pb-3 border-b border-borderSlate/40">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Interface Theme</span>
                        <button 
                            onClick={toggleTheme}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-850 border border-borderSlate text-[10px] font-semibold text-white transition-all cursor-pointer shadow"
                        >
                            <i className={`fa-solid ${theme === 'dark' ? 'fa-sun text-amber-500' : 'fa-moon text-indigo-400'}`}></i>
                            <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
                        </button>
                    </div>

                    <div>
                        <div className="flex items-center gap-2 text-xs text-statusGreen mb-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-statusGreen animate-ping"></span>
                            <span className="font-semibold text-[11px]">System Status</span>
                        </div>
                        <p className="text-[10px] text-slate-400">All Systems Operational (99.98% Uptime)</p>
                    </div>
                    <div className="text-[10px] text-slate-400 space-y-1.5 bg-slate-900/60 p-2.5 rounded-lg border border-borderSlate">
                        <span className="block font-bold text-slate-300 mb-1 uppercase tracking-wider text-[9px]">Data Sources</span>
                        <div className="flex justify-between"><span>Weather API</span><i className="fa-solid fa-circle-check text-statusGreen"></i></div>
                        <div className="flex justify-between"><span>News Feed</span><i className="fa-solid fa-circle-check text-statusGreen"></i></div>
                        <div className="flex justify-between"><span>Traffic API</span><i className="fa-solid fa-circle-check text-statusGreen"></i></div>
                        <div className="flex justify-between"><span>Warehouse IoT</span><i className="fa-solid fa-circle-check text-statusGreen"></i></div>
                    </div>
                </div>
            </div>
        );

        const Topbar = ({ 
            hqWeather, weatherScenario, systemTime, refreshTimer, onOpenSettings, weatherSourceString, lastFetchTime, isRefreshing, onManualRefresh,
            lastOrdersFetch, lastTrafficFetch, lastWeatherFetch, lastAqiFetch, lastNewsFetch,
            refreshingOrders, refreshingTraffic, refreshingWeather, refreshingAqi, refreshingNews,
            onRefreshOrders, onRefreshTraffic, onRefreshWeather, onRefreshAqi, onRefreshNews,
            apiPanelOpen, onToggleApiPanel, onCloseApiPanel,
            activeTab, setActiveTab
        }) => {
            const scenarioNames = {
                live: weatherSourceString || "Live Weather Feed",
                heatwave: "Heatwave Override",
                thunderstorm: "Thunderstorm Override",
                storm: "Wind Storm Override",
                gale: "Gale Winds Override",
                rain: "Heavy Rain Override",
                drizzle: "Light Drizzle Override"
            };
            
            const formatFetchTime = (fetchStr) => {
                if (!fetchStr || fetchStr === "Pending") {
                    return { date: "Pending", time: "N/A" };
                }
                const parts = fetchStr.split(',');
                if (parts.length >= 2) {
                    const datePart = parts[0].trim();
                    let timePart = parts[1].trim();
                    const match = timePart.match(/(\d+):(\d+):(\d+)(.*)/);
                    if (match) {
                        timePart = `${match[1]}:${match[2]}${match[4]}`;
                    }
                    return { date: datePart, time: timePart };
                }
                const partsSpace = fetchStr.trim().split(/\s+/);
                if (partsSpace.length >= 2) {
                    const datePart = partsSpace[0];
                    let timePart = partsSpace.slice(1).join(' ');
                    const match = timePart.match(/(\d+):(\d+):(\d+)(.*)/);
                    if (match) {
                        timePart = `${match[1]}:${match[2]}${match[4]}`;
                    }
                    return { date: datePart, time: timePart };
                }
                return { date: fetchStr, time: "N/A" };
            };

            const renderApiCard = (title, icon, timeStr, refreshing, onRefresh, tooltip, colorClass, badgeColorClass) => {
                const { date, time } = formatFetchTime(timeStr);
                return (
                    <div className="flex items-start justify-between bg-slate-900/40 p-2.5 rounded-lg border border-borderSlate/50 hover:border-slate-700/80 transition-all duration-200 gap-2">
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between font-bold text-white text-[11px] gap-2">
                                <span className="flex items-center gap-1.5 truncate">
                                    <i className={`fa-solid ${icon} ${colorClass} shrink-0 text-[10px]`}></i>
                                    <span className="truncate">{title}</span>
                                </span>
                                <span className={`px-1.5 py-0.5 rounded ${badgeColorClass} text-[9px] font-mono font-bold shrink-0`}>
                                    {time}
                                </span>
                            </div>
                            <div className="mt-1 font-mono text-[9px] text-slate-400 flex items-center justify-between">
                                <span>Date: {date}</span>
                                {refreshing && <span className="text-[8px] text-slate-500 animate-pulse">Syncing...</span>}
                            </div>
                        </div>
                        <button 
                            onClick={onRefresh}
                            disabled={isRefreshing || refreshing}
                            className="p-1.5 bg-slate-950 border border-borderSlate rounded text-[10px] text-slate-300 hover:text-white hover:border-slate-500 transition disabled:opacity-50 cursor-pointer self-center shrink-0 active:scale-90"
                            title={tooltip}
                        >
                            <i className={`fa-solid fa-arrows-rotate ${refreshing ? 'animate-spin' : ''}`}></i>
                        </button>
                    </div>
                );
            };

            return (
                <div className="h-14 border-b border-borderSlate bg-panelBg px-6 flex items-center justify-between shrink-0 relative z-[9999]">
                    <div className="min-w-0 mr-4">
                        <h2 className="text-sm md:text-base font-bold text-white tracking-wide truncate">Mission Control</h2>
                        <p className="text-[10px] text-slate-400 truncate hidden md:block">Real-time visibility. Smarter decisions. On-time delivery.</p>
                    </div>
                    <div className="flex items-center gap-2.5 text-xs text-slate-300 flex-nowrap shrink-0 select-none">
                        {/* New Order Trigger */}
                        <button 
                            onClick={() => setActiveTab("newOrder")}
                            className={`flex items-center gap-1.5 border px-2.5 py-1 rounded-md text-[11px] hover:text-white transition active:scale-95 cursor-pointer select-none whitespace-nowrap shrink-0 ${
                                activeTab === "newOrder" 
                                    ? "bg-brandBlue text-white border-brandBlue shadow-lg shadow-brandBlue/20" 
                                    : "bg-slate-900/60 border-borderSlate text-slate-300"
                            }`}
                            title="Create a New Order and add it to backend database"
                        >
                            <i className="fa-solid fa-file-circle-plus text-statusGreen"></i>
                            <span className="font-semibold">Create Order</span>
                        </button>

                        {/* API Panel Trigger */}
                        <div className="relative">
                            <button 
                                onClick={onToggleApiPanel}
                                className="flex items-center gap-1.5 bg-slate-900/60 border border-borderSlate px-2.5 py-1 rounded-md text-[11px] hover:text-white transition active:scale-95 cursor-pointer select-none whitespace-nowrap shrink-0"
                                title="API Diagnostics and Individual Sync Controls"
                            >
                                <i className="fa-solid fa-satellite-dish text-brandBlue animate-pulse"></i>
                                <span className="font-semibold hidden lg:inline">API Control Panel</span>
                                <span className="font-semibold lg:hidden">API Control</span>
                            </button>
                            
                            {apiPanelOpen && (
                                <div className="absolute left-0 top-full mt-1 w-80 bg-panelBg border border-borderSlate rounded-xl p-4 shadow-2xl z-[99999] text-xs space-y-3 font-sans">
                                    <div className="flex justify-between items-center border-b border-borderSlate/40 pb-2">
                                        <span className="font-bold text-white uppercase tracking-wider text-[10px]">API Diagnostics</span>
                                        <button onClick={onCloseApiPanel} className="text-slate-400 hover:text-white"><i className="fa-solid fa-xmark text-sm"></i></button>
                                    </div>
                                    <div className="space-y-2.5">
                                        {/* Orders API */}
                                        {renderApiCard(
                                            "Orders Database",
                                            "fa-file-csv",
                                            lastOrdersFetch,
                                            refreshingOrders,
                                            onRefreshOrders,
                                            "Sync orders.csv",
                                            "text-statusGreen",
                                            "bg-statusGreen/10 text-statusGreen"
                                        )}

                                        {/* TomTom Traffic API */}
                                        {renderApiCard(
                                            "TomTom Traffic",
                                            "fa-traffic-light",
                                            lastTrafficFetch,
                                            refreshingTraffic,
                                            onRefreshTraffic,
                                            "Sync TomTom Flow API",
                                            "text-amber-500",
                                            "bg-amber-500/10 text-amber-500"
                                        )}

                                        {/* Weather API Cascade */}
                                        {renderApiCard(
                                            "Weather Cascade",
                                            "fa-cloud-sun",
                                            lastWeatherFetch,
                                            refreshingWeather,
                                            onRefreshWeather,
                                            "Bypass weather cache and fetch fresh",
                                            "text-brandBlue",
                                            "bg-brandBlue/10 text-brandBlue"
                                        )}

                                        {/* WAQI AQI API */}
                                        {renderApiCard(
                                            "WAQI Air Quality",
                                            "fa-smog",
                                            lastAqiFetch,
                                            refreshingAqi,
                                            onRefreshAqi,
                                            "Sync AQI from World Air Quality Index",
                                            "text-statusPurple animate-pulse",
                                            "bg-statusPurple/10 text-statusPurple"
                                        )}

                                        {/* Google News RSS Feed */}
                                        {renderApiCard(
                                            "Disruption News RSS",
                                            "fa-newspaper",
                                            lastNewsFetch,
                                            refreshingNews,
                                            onRefreshNews,
                                            "Sync live logistics news",
                                            "text-slate-400",
                                            "bg-slate-400/10 text-slate-300"
                                        )}
                                    </div>

                                    <div className="border-t border-borderSlate/40 pt-2 flex justify-between items-center mt-4">
                                        <span className="text-[9px] text-slate-400">Bypass cache & sync all:</span>
                                        <button 
                                            onClick={onManualRefresh}
                                            disabled={isRefreshing || refreshingOrders || refreshingTraffic || refreshingWeather || refreshingAqi || refreshingNews}
                                            className="px-2.5 py-1 bg-brandBlue hover:bg-brandBlue/90 disabled:bg-slate-800 text-[10px] text-white font-bold rounded transition active:scale-95 cursor-pointer font-sans"
                                        >
                                            Force Sync All
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-1.5 bg-slate-900/60 border border-borderSlate px-2.5 py-1 rounded-md text-[11px] whitespace-nowrap shrink-0">
                            <i className="fa-solid fa-arrows-rotate text-statusGreen animate-spin" style={{ animationDuration: '3s' }}></i>
                            <span><span className="hidden sm:inline">Auto Refresh: </span><span className="font-bold text-white font-mono">{refreshTimer}s</span></span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-slate-900/60 border border-borderSlate px-2.5 py-1 rounded-md text-[11px] whitespace-nowrap shrink-0">
                            <i className="fa-solid fa-cloud-sun text-brandBlue animate-pulse"></i>
                            <span><span className="hidden sm:inline">HQ Temp: </span><span className="font-bold text-white font-mono">{hqWeather}</span></span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-slate-900/60 border border-borderSlate px-2.5 py-1 rounded-md text-[11px] whitespace-nowrap shrink-0">
                            <i className="fa-solid fa-satellite text-statusPurple animate-pulse"></i>
                            <span><span className="hidden md:inline">Simulation: </span><span className="font-bold text-statusPurple">{scenarioNames[weatherScenario] || "Live"}</span></span>
                        </div>
                        <div className="font-mono text-[11px] bg-slate-900/60 border border-borderSlate px-2.5 py-1 rounded-md text-slate-300 whitespace-nowrap shrink-0 hidden sm:block">
                            {systemTime || "Loading Time..."}
                        </div>
                        <div 
                            onClick={onOpenSettings} 
                            className="relative cursor-pointer text-slate-400 hover:text-white transition shrink-0"
                            title="Weather API Settings"
                        >
                            <i className="fa-solid fa-gear text-[14px]"></i>
                        </div>
                        <div className="relative cursor-pointer shrink-0"><i className="fa-regular fa-bell text-sm"></i><span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-statusRed"></span></div>
                        <select className="bg-slate-900 border border-borderSlate text-[11px] rounded px-2.5 py-1 text-white outline-none hidden lg:block">
                            <option>Global View (Patna Hub)</option>
                        </select>
                        <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center font-bold text-white text-[11px] border border-borderSlate">AK</div>
                    </div>
                </div>
            );
        };

        const KPIGrid = ({ data }) => (
            <div className="grid grid-cols-6 gap-3 shrink-0">
                {[
                    { label: "Total Deliveries", val: data.total, change: data.totalChange, color: data.totalColor, marker: true },
                    { label: "On Time Ratio", val: data.onTime, change: data.onTimeChange, color: data.onTimeColor },
                    { label: "Active Delays", val: data.delayed, change: data.delayedChange, color: data.delayedColor },
                    { label: "At Risk", val: data.atRisk, change: data.atRiskChange, color: data.atRiskColor },
                    { label: "Weather Impacted", val: data.weather, change: data.weatherChange, color: data.weatherColor },
                    { label: "Est. Impact Cost", val: data.financial, change: data.financialChange, color: data.financialColor }
                ].map((k, i) => (
                    <div key={i} className="bg-panelBg border border-borderSlate p-3 rounded-xl flex flex-col justify-between">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">{k.label}</span>
                        <div className="flex items-baseline gap-2 mt-1.5">
                            <span className="text-xl font-black text-white">{k.val}</span>
                            {k.marker && <span className="text-[9px] bg-statusGreen/10 text-statusGreen px-1 rounded font-bold">Live</span>}
                        </div>
                        <span className={`text-[9px] font-medium mt-1 ${k.color}`}>{k.change}</span>
                    </div>
                ))}
            </div>
        );

        // --- WEATHER MATRIX COMPONENT ---
        const WeatherView = ({ citiesWeatherList, hubsCoords, onOpenSettings, isOwmFallback, theme }) => {
            const [searchTerm, setSearchTerm] = useState("");
            const [typeFilter, setTypeFilter] = useState("all");
            const [severityFilter, setSeverityFilter] = useState("all");
            const [tempSort, setTempSort] = useState("none");
            const [viewMode, setViewMode] = useState("grid"); // "grid" or "table"
            
            const [selectedCity, setSelectedCity] = useState(null);
            const [detailLoading, setDetailLoading] = useState(false);
            const [detailError, setDetailError] = useState(null);
            const [forecastDetails, setForecastDetails] = useState(null);
            const [historyDetails, setHistoryDetails] = useState(null);
            const [activeDetailTab, setActiveDetailTab] = useState("forecast"); // "forecast" or "history"
            
            const chartRef = useRef(null);
            const chartInstanceRef = useRef(null);
            
            const handleCityClick = async (city) => {
                setSelectedCity(city);
                setForecastDetails(null);
                setHistoryDetails(null);
                setDetailError(null);
                setDetailLoading(true);
                
                try {
                    const startStr = getNDaysAgoStr(14);
                    const endStr = getNDaysAgoStr(1);
                    const lat = city.lat;
                    const lon = city.lon;
                    
                    const [forecastRes, historyRes] = await Promise.all([
                        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&timezone=auto`),
                        fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${startStr}&end_date=${endStr}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`)
                    ]);
                    
                    if (!forecastRes.ok) throw new Error("Forecast API failed");
                    if (!historyRes.ok) throw new Error("Historical Archive API failed");
                    
                    const forecastJson = await forecastRes.json();
                    const historyJson = await historyRes.json();
                    
                    setForecastDetails(forecastJson.daily);
                    setHistoryDetails(historyJson.daily);
                } catch (err) {
                    console.error("Error fetching city weather details:", err);
                    setDetailError("Failed to fetch detailed weather telemetry. Please try again.");
                } finally {
                    setDetailLoading(false);
                }
            };
            
            const getNDaysAgoStr = (n) => {
                const d = new Date();
                d.setDate(d.getDate() - n);
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                return `${yyyy}-${mm}-${dd}`;
            };
            
            const getWeatherSeverity = (weather) => {
                if (!weather || weather.temp === null || weather.temp === undefined) return "Unknown";
                const delay = weather.delay || 0;
                if (delay >= 90) return "Critical";
                if (delay >= 45) return "High";
                if (delay >= 15) return "Medium";
                return "Low";
            };
            
            useEffect(() => {
                if (!chartRef.current) return;
                
                if (chartInstanceRef.current) {
                    chartInstanceRef.current.destroy();
                    chartInstanceRef.current = null;
                }
                
                const dataToUse = activeDetailTab === "forecast" ? forecastDetails : historyDetails;
                if (!dataToUse || !dataToUse.time) return;
                
                const ctx = chartRef.current.getContext('2d');
                
                const tempGrad = ctx.createLinearGradient(0, 0, 0, 160);
                tempGrad.addColorStop(0, 'rgba(239, 68, 68, 0.25)');
                tempGrad.addColorStop(1, 'rgba(239, 68, 68, 0.0)');
                
                const rainGrad = ctx.createLinearGradient(0, 0, 0, 160);
                rainGrad.addColorStop(0, 'rgba(59, 130, 246, 0.25)');
                rainGrad.addColorStop(1, 'rgba(59, 130, 246, 0.0)');
                
                const labels = dataToUse.time.map(t => {
                    const d = new Date(t);
                    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                });
                
                const datasets = [
                    {
                        label: 'Max Temp (°C)',
                        data: dataToUse.temperature_2m_max,
                        borderColor: '#ef4444',
                        backgroundColor: tempGrad,
                        fill: true,
                        tension: 0.3,
                        yAxisID: 'yTemp',
                        borderWidth: 2,
                        pointRadius: 2
                    },
                    {
                        label: 'Min Temp (°C)',
                        data: dataToUse.temperature_2m_min,
                        borderColor: '#3b82f6',
                        borderDash: [3, 3],
                        backgroundColor: 'transparent',
                        tension: 0.3,
                        yAxisID: 'yTemp',
                        borderWidth: 1.5,
                        pointRadius: 1
                    },
                    {
                        label: 'Precipitation (mm)',
                        data: dataToUse.precipitation_sum,
                        borderColor: '#10b981',
                        backgroundColor: rainGrad,
                        fill: true,
                        tension: 0.3,
                        yAxisID: 'yPrecip',
                        borderWidth: 2,
                        pointRadius: 2
                    }
                ];
                
                chartInstanceRef.current = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: datasets
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                labels: { color: theme === 'dark' ? '#94a3b8' : '#475569', font: { size: 9 }, boxWidth: 10 }
                            },
                            tooltip: {
                                mode: 'index',
                                intersect: false
                            }
                        },
                        scales: {
                            x: {
                                grid: { color: theme === 'dark' ? 'rgba(30, 41, 59, 0.3)' : 'rgba(148, 163, 184, 0.2)' },
                                ticks: { color: theme === 'dark' ? '#94a3b8' : '#475569', font: { size: 8 } }
                            },
                            yTemp: {
                                position: 'left',
                                grid: { color: theme === 'dark' ? 'rgba(30, 41, 59, 0.3)' : 'rgba(148, 163, 184, 0.2)' },
                                ticks: { color: '#ef4444', font: { size: 8 } },
                                title: {
                                    display: true,
                                    text: 'Temp (°C)',
                                    color: '#ef4444',
                                    font: { size: 8, weight: 'bold' }
                                }
                            },
                            yPrecip: {
                                position: 'right',
                                grid: { drawOnChartArea: false },
                                ticks: { color: '#10b981', font: { size: 8 } },
                                title: {
                                    display: true,
                                    text: 'Rain (mm)',
                                    color: '#10b981',
                                    font: { size: 8, weight: 'bold' }
                                }
                            }
                        }
                    }
                });
                
                return () => {
                    if (chartInstanceRef.current) {
                        chartInstanceRef.current.destroy();
                        chartInstanceRef.current = null;
                    }
                };
            }, [forecastDetails, historyDetails, activeDetailTab, theme]);
            
            if (!citiesWeatherList || citiesWeatherList.length === 0) {
                return (
                    <div className="flex-1 flex flex-col items-center justify-center bg-[#0b111e] text-slate-200">
                        <div className="w-8 h-8 border-2 border-brandBlue border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider mt-2.5">Loading weather matrix...</span>
                    </div>
                );
            }
            
            const filteredCities = citiesWeatherList
                .filter(city => {
                    const matchesSearch = city.destination.toLowerCase().includes(searchTerm.toLowerCase());
                    
                    let matchesType = true;
                    if (typeFilter !== "all") {
                        const type = city.weather ? city.weather.type : "clear";
                        if (typeFilter === "clear") {
                            matchesType = ["clear", "heat", "cold"].includes(type);
                        } else if (typeFilter === "rain") {
                            matchesType = ["rain", "drizzle"].includes(type);
                        } else if (typeFilter === "storm") {
                            matchesType = ["thunderstorm"].includes(type);
                        } else if (typeFilter === "wind") {
                            matchesType = ["gale", "windy"].includes(type);
                        } else if (typeFilter === "fog") {
                            matchesType = ["fog"].includes(type);
                        }
                    }
                    
                    let matchesSeverity = true;
                    if (severityFilter !== "all") {
                        const severity = getWeatherSeverity(city.weather);
                        matchesSeverity = severity.toLowerCase() === severityFilter.toLowerCase();
                    }
                    
                    return matchesSearch && matchesType && matchesSeverity;
                })
                .sort((a, b) => {
                    if (tempSort === "asc") {
                        return (a.weather ? a.weather.temp : 0) - (b.weather ? b.weather.temp : 0);
                    }
                    if (tempSort === "desc") {
                        return (b.weather ? b.weather.temp : 0) - (a.weather ? a.weather.temp : 0);
                    }
                    return a.destination.localeCompare(b.destination);
                });
                
            const totalHubs = citiesWeatherList.length;
            const criticalHubs = citiesWeatherList.filter(c => getWeatherSeverity(c.weather) === "Critical").length;
            const highHubs = citiesWeatherList.filter(c => getWeatherSeverity(c.weather) === "High").length;
            const mediumHubs = citiesWeatherList.filter(c => getWeatherSeverity(c.weather) === "Medium").length;
            
            return (
                <div className="flex-1 p-5 overflow-hidden flex flex-col gap-4 h-full min-h-0 bg-darkBg text-slate-100">
                    {isOwmFallback ? (
                        <div className="bg-amber-950/30 border border-amber-500/20 text-amber-500 text-xs px-4 py-2.5 rounded-xl flex justify-between items-center shrink-0">
                            <span className="flex items-center gap-2">
                                <i className="fa-solid fa-triangle-exclamation text-sm animate-pulse"></i>
                                <span>OpenWeatherMap API Key is invalid or inactive (401). Falling back to Weather Feed (Cascade) for live telemetry.</span>
                            </span>
                            <button 
                                onClick={onOpenSettings}
                                className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-[10px] uppercase tracking-wider transition"
                            >
                                Configure Key
                            </button>
                        </div>
                    ) : !(localStorage.getItem('openweathermap_api_key') || "000bd6759eb2260d3900697d8faf36fd") && (
                        <div className="bg-amber-950/30 border border-amber-500/20 text-amber-500 text-xs px-4 py-2.5 rounded-xl flex justify-between items-center shrink-0">
                            <span className="flex items-center gap-2">
                                <i className="fa-solid fa-triangle-exclamation text-sm animate-pulse"></i>
                                <span>OpenWeatherMap integration is active. Please configure your API key to fetch actual weather and AQI telemetry.</span>
                            </span>
                            <button 
                                onClick={onOpenSettings}
                                className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-[10px] uppercase tracking-wider transition"
                            >
                                Configure Key
                            </button>
                        </div>
                    )}
                    <div className="flex justify-between items-center shrink-0">
                        <div>
                            <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                                <i className="fa-solid fa-cloud-bolt text-brandBlue animate-pulse"></i>
                                Weather & AQI Monitor Matrix
                            </h2>
                            <p className="text-[10px] text-slate-400">Live route hub conditions, forecast models, and historical reanalysis telemetry.</p>
                        </div>
                        <div className="flex items-center gap-1.5 bg-slate-900 border border-borderSlate p-1 rounded-lg">
                            <button 
                                onClick={() => setViewMode("grid")}
                                className={`px-2.5 py-1 rounded text-xs transition duration-150 flex items-center gap-1.5 ${viewMode === "grid" ? "bg-brandBlue text-white font-bold" : "text-slate-400 hover:text-white"}`}
                            >
                                <i className="fa-solid fa-table-cells-large text-[11px]"></i> Card Matrix
                            </button>
                            <button 
                                onClick={() => setViewMode("table")}
                                className={`px-2.5 py-1 rounded text-xs transition duration-150 flex items-center gap-1.5 ${viewMode === "table" ? "bg-brandBlue text-white font-bold" : "text-slate-400 hover:text-white"}`}
                            >
                                <i className="fa-solid fa-table-list text-[11px]"></i> Table Grid
                            </button>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-3 shrink-0">
                        <div className="bg-panelBg/80 border border-borderSlate px-3 py-2 rounded-xl flex items-center justify-between">
                            <div>
                                <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400">Monitored Hubs</span>
                                <div className="text-base font-black text-white mt-0.5">{totalHubs} <span className="text-[9px] font-normal text-slate-500">Cities</span></div>
                            </div>
                            <div className="w-8 h-8 rounded-lg bg-blue-950/40 border border-blue-500/20 flex items-center justify-center text-brandBlue">
                                <i className="fa-solid fa-earth-asia"></i>
                            </div>
                        </div>
                        <div className="bg-panelBg/80 border border-borderSlate px-3 py-2 rounded-xl flex items-center justify-between border-l-statusRed border-l-2">
                            <div>
                                <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400">Critical Warnings</span>
                                <div className="text-base font-black text-statusRed mt-0.5">{criticalHubs} <span className="text-[9px] font-normal text-slate-500">Hubs</span></div>
                            </div>
                            <div className="w-8 h-8 rounded-lg bg-red-950/40 border border-red-500/20 flex items-center justify-center text-statusRed">
                                <i className="fa-solid fa-triangle-exclamation animate-pulse"></i>
                            </div>
                        </div>
                        <div className="bg-panelBg/80 border border-borderSlate px-3 py-2 rounded-xl flex items-center justify-between border-l-statusOrange border-l-2">
                            <div>
                                <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400">High Impact</span>
                                <div className="text-base font-black text-statusOrange mt-0.5">{highHubs} <span className="text-[9px] font-normal text-slate-500">Hubs</span></div>
                            </div>
                            <div className="w-8 h-8 rounded-lg bg-orange-950/40 border border-orange-500/20 flex items-center justify-center text-statusOrange">
                                <i className="fa-solid fa-cloud-showers-heavy"></i>
                            </div>
                        </div>
                        <div className="bg-panelBg/80 border border-borderSlate px-3 py-2 rounded-xl flex items-center justify-between border-l-statusGreen border-l-2">
                            <div>
                                <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400">Low Impact</span>
                                <div className="text-base font-black text-statusGreen mt-0.5">{totalHubs - criticalHubs - highHubs - mediumHubs} <span className="text-[9px] font-normal text-slate-500">Hubs</span></div>
                            </div>
                            <div className="w-8 h-8 rounded-lg bg-emerald-950/40 border border-emerald-500/20 flex items-center justify-center text-statusGreen">
                                <i className="fa-solid fa-circle-check"></i>
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-panelBg border border-borderSlate p-3 rounded-xl flex flex-wrap items-center gap-3 shrink-0 text-xs">
                        <div className="relative flex-1 min-w-[200px]">
                            <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-500">
                                <i className="fa-solid fa-magnifying-glass text-[11px]"></i>
                            </span>
                            <input 
                                type="text" 
                                placeholder="Search city name..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-900 border border-borderSlate rounded-lg pl-8 pr-3 py-1.5 text-slate-200 placeholder-slate-500 outline-none focus:border-brandBlue focus:ring-1 focus:ring-brandBlue/30 transition text-xs"
                            />
                            {searchTerm && (
                                <button onClick={() => setSearchTerm("")} className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-500 hover:text-white">
                                    <i className="fa-solid fa-circle-xmark"></i>
                                </button>
                            )}
                        </div>
                        
                        <div className="flex items-center gap-1.5">
                            <span className="text-slate-400 font-medium">Weather:</span>
                            <select
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value)}
                                className="bg-slate-900 border border-borderSlate rounded-lg px-2.5 py-1.5 text-slate-200 outline-none focus:border-brandBlue transition cursor-pointer text-xs"
                            >
                                <option value="all">All Types</option>
                                <option value="clear">☀️ Clear / Sunny</option>
                                <option value="rain">🌧️ Rainy / Drizzle</option>
                                <option value="storm">⛈️ Thunderstorms</option>
                                <option value="wind">💨 Windy / Gale</option>
                                <option value="fog">🌫️ Foggy</option>
                            </select>
                        </div>
                        
                        <div className="flex items-center gap-1.5">
                            <span className="text-slate-400 font-medium">Severity:</span>
                            <select
                                value={severityFilter}
                                onChange={(e) => setSeverityFilter(e.target.value)}
                                className="bg-slate-900 border border-borderSlate rounded-lg px-2.5 py-1.5 text-slate-200 outline-none focus:border-brandBlue transition cursor-pointer text-xs"
                            >
                                <option value="all">All Severities</option>
                                <option value="Low">🟢 Low Impact</option>
                                <option value="Medium">🟡 Medium Impact</option>
                                <option value="High">🟠 High Impact</option>
                                <option value="Critical">🔴 Critical Impact</option>
                            </select>
                        </div>
                        
                        <div className="flex items-center gap-1.5">
                            <span className="text-slate-400 font-medium">Temperature:</span>
                            <select
                                value={tempSort}
                                onChange={(e) => setTempSort(e.target.value)}
                                className="bg-slate-900 border border-borderSlate rounded-lg px-2.5 py-1.5 text-slate-200 outline-none focus:border-brandBlue transition cursor-pointer text-xs"
                            >
                                <option value="none">Default Sort</option>
                                <option value="asc">🌡️ Increasing (Low → High)</option>
                                <option value="desc">🌡️ Decreasing (High → Low)</option>
                            </select>
                        </div>
                        
                        {(searchTerm || typeFilter !== "all" || severityFilter !== "all" || tempSort !== "none") && (
                            <button 
                                onClick={() => {
                                    setSearchTerm("");
                                    setTypeFilter("all");
                                    setSeverityFilter("all");
                                    setTempSort("none");
                                }}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-borderSlate rounded-lg transition font-medium text-xs flex items-center gap-1.5"
                            >
                                <i className="fa-solid fa-arrow-rotate-left"></i> Reset
                            </button>
                        )}
                    </div>
                    
                    <div className="flex-1 flex gap-4 overflow-hidden min-h-0">
                        <div className={`overflow-y-auto custom-scrollbar flex-1 min-h-0 bg-slate-950/20 border border-borderSlate rounded-xl p-2 transition-all duration-300 ${selectedCity ? "w-2/3" : "w-full"}`}>
                            {filteredCities.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center gap-2.5 text-slate-500 py-12">
                                    <i className="fa-solid fa-cloud-sun text-4xl text-slate-700 animate-pulse"></i>
                                    <div className="text-xs font-semibold">No hubs match the current filter selection.</div>
                                </div>
                            ) : viewMode === "grid" ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                    {filteredCities.map((city, idx) => {
                                        const w = city.weather || { temp: null, windspeed: null, rain: null, description: "Loading Weather...", icon: "fa-spinner animate-spin text-brandBlue", delay: 0 };
                                        const a = city.aqi || { aqi: null, pm2_5: null, pm10: null };
                                        const severity = getWeatherSeverity(w);
                                        const isSelected = selectedCity && selectedCity.destination === city.destination;
                                        
                                        const severityColors = {
                                            Critical: { border: "border-statusRed", text: "text-statusRed", bg: "bg-red-950/20", badge: "bg-red-950/50 text-statusRed border-statusRed/30" },
                                            High: { border: "border-statusOrange", text: "text-statusOrange", bg: "bg-orange-950/20", badge: "bg-orange-950/50 text-statusOrange border-statusOrange/30" },
                                            Medium: { border: "border-statusOrange", text: "text-amber-500", bg: "bg-amber-950/20", badge: "bg-amber-950/50 text-amber-500 border-amber-500/20" },
                                            Low: { border: "border-borderSlate", text: "text-statusGreen", bg: "bg-emerald-950/20", badge: "bg-emerald-950/50 text-statusGreen border-statusGreen/20" },
                                            Unknown: { border: "border-borderSlate", text: "text-slate-500", bg: "bg-slate-900/20", badge: "bg-slate-900/50 text-slate-400 border-borderSlate/30" }
                                        };
                                        
                                        const activeColor = severityColors[severity] || severityColors.Unknown;
                                        
                                        return (
                                            <div 
                                                key={idx}
                                                onClick={() => handleCityClick(city)}
                                                className={`group relative p-3 bg-panelBg border rounded-xl flex flex-col justify-between cursor-pointer transition-all duration-200 ${isSelected ? "border-brandBlue ring-1 ring-brandBlue/30 bg-panelBg/90 shadow-brandBlue/10 shadow-lg scale-[0.99]" : `hover:border-slate-500 border-borderSlate hover:scale-[1.01] hover:shadow-xl`}`}
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <h4 className="text-[11px] font-bold text-white group-hover:text-brandBlue transition-colors truncate max-w-[120px]">{city.destination.split(",")[0]}</h4>
                                                        <span className="text-[8px] text-slate-500 font-mono block mt-0.5">{city.lat.toFixed(4)}, {city.lon.toFixed(4)}</span>
                                                    </div>
                                                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase shrink-0 ${activeColor.badge}`}>
                                                        {severity}
                                                    </span>
                                                </div>
                                                
                                                <div className="flex items-center gap-3 my-2.5">
                                                    {w.temp !== null && w.temp !== undefined ? (
                                                        <>
                                                            <div className="text-xl font-black text-white font-mono tracking-tight">{Math.round(w.temp)}°C</div>
                                                            <div className="flex items-center gap-1.5 text-[10px] text-slate-300">
                                                                <i className={`fa-solid ${w.icon} text-sm`}></i>
                                                                <span className="truncate max-w-[100px]" title={w.description}>{w.description}</span>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 italic">
                                                            <i className="fa-solid fa-spinner animate-spin text-brandBlue"></i> Loading Weather...
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                <div className="grid grid-cols-3 gap-1.5 border-t border-borderSlate/60 pt-2 text-[9px] text-slate-400">
                                                    <div className="flex flex-col">
                                                        <span>Wind</span>
                                                        <span className="font-semibold text-slate-200 mt-0.5">
                                                            {w.windspeed !== null && w.windspeed !== undefined ? `${Math.round(w.windspeed)} km/h` : "--"}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span>Rain</span>
                                                        <span className="font-semibold text-slate-200 mt-0.5">
                                                            {w.rain !== null && w.rain !== undefined ? `${w.rain.toFixed(1)} mm` : "--"}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span>AQI</span>
                                                        <span className={`font-semibold mt-0.5 ${a.aqi > 150 ? 'text-statusRed font-bold' : (a.aqi > 100 ? 'text-statusOrange font-bold' : 'text-statusGreen')}`}>
                                                            {a.aqi !== null && a.aqi !== undefined ? `${a.aqi} AQI` : "--"}
                                                        </span>
                                                    </div>
                                                </div>
                                                
                                                {w.delay > 0 && (
                                                    <div className="mt-2.5 flex items-center justify-between bg-slate-900/60 border border-borderSlate/40 rounded px-1.5 py-0.5 text-[8px]">
                                                        <span className="text-slate-500 flex items-center gap-1">
                                                            <i className="fa-solid fa-clock text-amber-500 animate-pulse"></i> Delay:
                                                        </span>
                                                        <span className="font-bold text-statusRed font-mono">+{w.delay} mins</span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="overflow-x-auto w-full">
                                    <table className="w-full text-left text-[11px] text-slate-300 border-collapse table-fixed">
                                        <thead>
                                            <tr className="text-slate-500 border-b border-borderSlate text-[9px] uppercase tracking-wider">
                                                <th className="pb-2 w-28 pl-2">City</th>
                                                <th className="pb-2 w-16 text-right">Temp</th>
                                                <th className="pb-2 w-44 pl-4">Weather Condition</th>
                                                <th className="pb-2 w-20 text-center">Severity</th>
                                                <th className="pb-2 w-18 text-right">Wind</th>
                                                <th className="pb-2 w-18 text-right">Rain</th>
                                                <th className="pb-2 w-20 text-center">Air Quality</th>
                                                <th className="pb-2 w-24 text-right pr-2">Delay Impact</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-borderSlate/30">
                                            {filteredCities.map((city, idx) => {
                                                const w = city.weather || { temp: null, windspeed: null, rain: null, description: "Loading Weather...", icon: "fa-spinner animate-spin text-brandBlue", delay: 0 };
                                                const a = city.aqi || { aqi: null, pm2_5: null, pm10: null };
                                                const severity = getWeatherSeverity(w);
                                                const isSelected = selectedCity && selectedCity.destination === city.destination;
                                                
                                                const badgeColors = {
                                                    Critical: "bg-red-950/40 text-statusRed border-statusRed/30",
                                                    High: "bg-orange-950/40 text-statusOrange border-statusOrange/30",
                                                    Medium: "bg-amber-950/40 text-amber-500 border-amber-500/20",
                                                    Low: "bg-emerald-950/40 text-statusGreen border-statusGreen/20",
                                                    Unknown: "bg-slate-900/40 text-slate-400 border-borderSlate/30"
                                                };
                                                
                                                return (
                                                    <tr 
                                                        key={idx}
                                                        onClick={() => handleCityClick(city)}
                                                        className={`hover:bg-slate-800/20 cursor-pointer transition-colors border-b border-borderSlate/20 ${isSelected ? "bg-brandBlue/5 font-bold" : ""}`}
                                                    >
                                                        <td className="py-2.5 font-bold text-white pl-2">
                                                            <div>{city.destination}</div>
                                                            <span className="text-[8px] text-slate-500 font-mono font-normal">{city.lat.toFixed(4)}, {city.lon.toFixed(4)}</span>
                                                        </td>
                                                        <td className="py-2.5 text-right font-mono font-bold text-slate-200">
                                                            {w.temp !== null ? `${Math.round(w.temp)}°C` : "--"}
                                                        </td>
                                                        <td className="py-2.5 pl-4">
                                                            {w.temp !== null ? (
                                                                <div className="flex items-center gap-2">
                                                                    <i className={`fa-solid ${w.icon} text-slate-400 text-xs w-4`}></i>
                                                                    <span className="truncate" title={w.description}>{w.description}</span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-500 italic flex items-center gap-1"><i className="fa-solid fa-spinner animate-spin text-[10px]"></i> Loading...</span>
                                                            )}
                                                        </td>
                                                        <td className="py-2.5 text-center">
                                                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase ${badgeColors[severity]}`}>
                                                                {w.temp !== null ? severity : "--"}
                                                            </span>
                                                        </td>
                                                        <td className="py-2.5 text-right font-mono text-slate-300">
                                                            {w.windspeed !== null ? `${Math.round(w.windspeed)} km/h` : "--"}
                                                        </td>
                                                        <td className="py-2.5 text-right font-mono text-slate-300">
                                                            {w.rain !== null ? `${w.rain.toFixed(1)} mm` : "--"}
                                                        </td>
                                                        <td className="py-2.5 text-center">
                                                            {a.aqi !== null ? (
                                                                <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${
                                                                    a.aqi > 150 ? 'bg-red-950/30 text-statusRed' : 
                                                                    (a.aqi > 100 ? 'bg-orange-950/30 text-statusOrange' : 'bg-emerald-950/30 text-statusGreen')
                                                                }`}>{a.aqi} AQI</span>
                                                            ) : (
                                                                <span className="text-slate-500 font-mono text-[9px]">-</span>
                                                            )}
                                                        </td>
                                                        <td className="py-2.5 text-right font-semibold font-mono pr-2">
                                                            {w.temp !== null ? (
                                                                w.delay > 0 ? (
                                                                    <span className="text-statusRed">+{w.delay} mins</span>
                                                                ) : (
                                                                    <span className="text-statusGreen">Optimal</span>
                                                                )
                                                            ) : (
                                                                <span className="text-slate-500 font-mono">-</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                        
                        {selectedCity && (
                            <div className="w-[35%] shrink-0 bg-panelBg border border-borderSlate rounded-xl flex flex-col h-full overflow-hidden animate-fadeIn select-text">
                                <div className="p-3 border-b border-borderSlate flex justify-between items-center bg-slate-900/60 shrink-0">
                                    <div>
                                        <h3 className="text-xs font-bold text-white uppercase tracking-wider">{selectedCity.destination.split(",")[0]} Details</h3>
                                        <span className="text-[9px] text-slate-400 font-mono">{selectedCity.lat.toFixed(4)}°N, {selectedCity.lon.toFixed(4)}°E</span>
                                    </div>
                                    <button 
                                        onClick={() => setSelectedCity(null)}
                                        className="w-5 h-5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition border border-borderSlate cursor-pointer"
                                    >
                                        <i className="fa-solid fa-xmark text-[10px]"></i>
                                    </button>
                                </div>
                                
                                <div className="flex-1 overflow-y-auto p-3 space-y-3.5 custom-scrollbar text-[11px]">
                                    <div className="bg-slate-900/60 border border-borderSlate p-2.5 rounded-lg flex items-center justify-between">
                                        <div>
                                            <div className="text-[9px] uppercase font-bold text-slate-500">Current Status</div>
                                            <div className="text-lg font-black text-white mt-0.5">{Math.round(selectedCity.weather ? selectedCity.weather.temp : 24)}°C</div>
                                            <div className="text-[10px] text-slate-300 mt-0.5 flex items-center gap-1.5">
                                                <i className={`fa-solid ${selectedCity.weather ? selectedCity.weather.icon : "fa-sun text-yellow-400"}`}></i>
                                                <span>{selectedCity.weather ? selectedCity.weather.description : "Clear Sky"}</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase ${
                                                getWeatherSeverity(selectedCity.weather) === "Critical" ? "bg-red-950/50 text-statusRed border-statusRed/30" :
                                                getWeatherSeverity(selectedCity.weather) === "High" ? "bg-orange-950/50 text-statusOrange border-statusOrange/30" :
                                                getWeatherSeverity(selectedCity.weather) === "Medium" ? "bg-amber-950/50 text-amber-500 border-amber-500/20" :
                                                "bg-emerald-950/50 text-statusGreen border-statusGreen/20"
                                            }`}>
                                                {getWeatherSeverity(selectedCity.weather)}
                                            </span>
                                            {selectedCity.weather && selectedCity.weather.delay > 0 && (
                                                <div className="text-[9px] text-statusRed font-bold font-mono mt-1.5">+{selectedCity.weather.delay}m Delay</div>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="bg-slate-900/40 border border-borderSlate/60 p-2 rounded-lg space-y-1.5">
                                            <span className="font-bold text-[9px] text-slate-400 uppercase tracking-wider flex items-center gap-1"><i className="fa-solid fa-cloud-sun text-brandBlue"></i> Weather specs</span>
                                            <div className="flex justify-between"><span>Wind Speed</span><span className="font-bold text-slate-200">{Math.round(selectedCity.weather ? selectedCity.weather.windspeed : 10)} km/h</span></div>
                                            <div className="flex justify-between"><span>Precipitation</span><span className="font-bold text-slate-200">{selectedCity.weather ? selectedCity.weather.rain.toFixed(1) : "0.0"} mm</span></div>
                                        </div>
                                        <div className="bg-slate-900/40 border border-borderSlate/60 p-2 rounded-lg space-y-1.5">
                                            <span className="font-bold text-[9px] text-slate-400 uppercase tracking-wider flex items-center gap-1"><i className="fa-solid fa-smog text-amber-500"></i> AQI metrics</span>
                                            <div className="flex justify-between"><span>Air Quality</span><span className="font-bold text-slate-200">{selectedCity.aqi ? selectedCity.aqi.aqi : 85} AQI</span></div>
                                            <div className="flex justify-between"><span>PM2.5 / PM10</span><span className="font-bold text-slate-200">{selectedCity.aqi ? `${selectedCity.aqi.pm2_5}/${selectedCity.aqi.pm10}` : "12.0/15.0"}</span></div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex border-b border-borderSlate">
                                        <button 
                                            onClick={() => setActiveDetailTab("forecast")}
                                            className={`flex-1 py-1.5 font-bold transition text-center text-xs ${activeDetailTab === "forecast" ? "border-b-2 border-brandBlue text-white" : "text-slate-400 hover:text-slate-200"}`}
                                        >
                                            7-Day Forecast
                                        </button>
                                        <button 
                                            onClick={() => setActiveDetailTab("history")}
                                            className={`flex-1 py-1.5 font-bold transition text-center text-xs ${activeDetailTab === "history" ? "border-b-2 border-brandBlue text-white" : "text-slate-400 hover:text-slate-200"}`}
                                        >
                                            14-Day History
                                        </button>
                                    </div>
                                    
                                    {detailLoading ? (
                                        <div className="h-44 flex flex-col items-center justify-center gap-2">
                                            <div className="w-6 h-6 border-2 border-brandBlue border-t-transparent rounded-full animate-spin"></div>
                                            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Fetching live data...</span>
                                        </div>
                                    ) : detailError ? (
                                        <div className="h-44 flex flex-col items-center justify-center text-center p-4 border border-red-500/20 bg-red-950/10 rounded-lg text-slate-400">
                                            <i className="fa-solid fa-circle-exclamation text-statusRed text-lg mb-1.5"></i>
                                            <span>{detailError}</span>
                                        </div>
                                    ) : (forecastDetails || historyDetails) ? (
                                        <div className="space-y-3">
                                            <div className="h-44 relative bg-slate-950/60 border border-borderSlate rounded-lg p-1.5">
                                                <canvas ref={chartRef}></canvas>
                                            </div>
                                            
                                            <div className="border border-borderSlate rounded-lg overflow-hidden">
                                                <div className="max-h-32 overflow-y-auto custom-scrollbar">
                                                    <table className="w-full text-left text-[10px] text-slate-400 border-collapse table-fixed">
                                                        <thead>
                                                            <tr className="bg-slate-900 text-slate-500 border-b border-borderSlate text-[9px] uppercase sticky top-0">
                                                                <th className="py-1 px-2 w-20">Date</th>
                                                                <th className="py-1 text-right">Max (°C)</th>
                                                                <th className="py-1 text-right">Min (°C)</th>
                                                                <th className="py-1 text-right pr-2">Rain (mm)</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-borderSlate/20">
                                                            {(() => {
                                                                const data = activeDetailTab === "forecast" ? forecastDetails : historyDetails;
                                                                if (!data || !data.time) return null;
                                                                
                                                                return data.time.map((t, idx) => {
                                                                    const max = data.temperature_2m_max[idx];
                                                                    const min = data.temperature_2m_min[idx];
                                                                    const rain = data.precipitation_sum[idx];
                                                                    
                                                                    const formattedDate = new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                                                    
                                                                    return (
                                                                        <tr key={idx} className="hover:bg-slate-800/20 font-mono">
                                                                            <td className="py-1.5 px-2 text-slate-300 font-sans">{formattedDate}</td>
                                                                            <td className="py-1.5 text-right font-bold text-statusRed">{max !== null ? max.toFixed(1) : "--"}</td>
                                                                            <td className="py-1.5 text-right text-brandBlue">{min !== null ? min.toFixed(1) : "--"}</td>
                                                                            <td className="py-1.5 text-right text-slate-300 pr-2">{rain !== null ? rain.toFixed(1) : "0.0"}</td>
                                                                        </tr>
                                                                    );
                                                                });
                                                            })()}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="h-44 flex items-center justify-center text-slate-500 text-xs italic">
                                            No data available. Click a city to refresh.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            );
        };

        // --- ADD LOCATION VIEW ---
        const AddLocationView = ({ warehouses, hubsCoords, weatherData, aqiData, onAddWarehouse, onAddCity }) => {
            const [wName, setWName] = useState("");
            const [wLat, setWLat] = useState("");
            const [wLon, setWLon] = useState("");
            
            const [cName, setCName] = useState("");
            const [cLat, setCLat] = useState("");
            const [cLon, setCLon] = useState("");

            const [editingWarehouse, setEditingWarehouse] = useState(null);
            const [editingCity, setEditingCity] = useState(null);

            const [notification, setNotification] = useState(null);

            const showNotification = (message, type = "success") => {
                setNotification({ message, type });
                setTimeout(() => setNotification(null), 4000);
            };

            const submitWarehouse = async (e) => {
                e.preventDefault();
                if (!wName.trim() || !wLat || !wLon) {
                    showNotification("Please fill in all warehouse fields", "error");
                    return;
                }
                const latNum = parseFloat(wLat);
                const lonNum = parseFloat(wLon);
                if (isNaN(latNum) || latNum < -90 || latNum > 90) {
                    showNotification("Invalid latitude (-90 to 90)", "error");
                    return;
                }
                if (isNaN(lonNum) || lonNum < -180 || lonNum > 180) {
                    showNotification("Invalid longitude (-180 to 180)", "error");
                    return;
                }

                try {
                    const originalName = editingWarehouse ? editingWarehouse.originalName : undefined;
                    await onAddWarehouse(wName.trim(), latNum, lonNum, originalName);
                    showNotification(editingWarehouse ? `Warehouse updated successfully!` : `Warehouse "${wName}" registered successfully!`);
                    setWName("");
                    setWLat("");
                    setWLon("");
                    setEditingWarehouse(null);
                } catch (err) {
                    showNotification("Failed to save warehouse", "error");
                }
            };

            const submitCity = async (e) => {
                e.preventDefault();
                if (!cName.trim() || !cLat || !cLon) {
                    showNotification("Please fill in all city fields", "error");
                    return;
                }
                const latNum = parseFloat(cLat);
                const lonNum = parseFloat(cLon);
                if (isNaN(latNum) || latNum < -90 || latNum > 90) {
                    showNotification("Invalid latitude (-90 to 90)", "error");
                    return;
                }
                if (isNaN(lonNum) || lonNum < -180 || lonNum > 180) {
                    showNotification("Invalid longitude (-180 to 180)", "error");
                    return;
                }

                try {
                    const originalCity = editingCity ? editingCity.originalCity : undefined;
                    await onAddCity(cName.trim(), latNum, lonNum, originalCity);
                    showNotification(editingCity ? `Delivery city updated successfully!` : `Delivery city "${cName}" registered successfully!`);
                    setCName("");
                    setCLat("");
                    setCLon("");
                    setEditingCity(null);
                } catch (err) {
                    showNotification("Failed to save delivery city", "error");
                }
            };

            const startEditWarehouse = (w) => {
                setEditingWarehouse({ originalName: w.name, name: w.name, lat: w.lat, lon: w.lon });
                setWName(w.name);
                setWLat(w.lat.toString());
                setWLon(w.lon.toString());
            };

            const cancelEditWarehouse = () => {
                setEditingWarehouse(null);
                setWName("");
                setWLat("");
                setWLon("");
            };

            const startEditCity = (city, coords) => {
                setEditingCity({ originalCity: city, city: city, lat: coords.lat, lon: coords.lon });
                setCName(city);
                setCLat(coords.lat.toString());
                setCLon(coords.lon.toString());
            };

            const cancelEditCity = () => {
                setEditingCity(null);
                setCName("");
                setCLat("");
                setCLon("");
            };

            return (
                <div className="flex-1 p-6 overflow-y-auto space-y-6 custom-scrollbar text-slate-300 font-sans bg-darkBg">
                    {notification && (
                        <div className={`fixed top-4 right-4 z-[10000] p-4 rounded-xl border flex items-center gap-3 shadow-2xl transition-all duration-300 ${
                            notification.type === "success" 
                                ? "bg-emerald-950/90 text-statusGreen border-statusGreen/30" 
                                : "bg-red-950/90 text-statusRed border-statusRed/30"
                        }`}>
                            <i className={`fa-solid ${notification.type === "success" ? "fa-circle-check" : "fa-circle-exclamation"} text-lg`}></i>
                            <span className="text-xs font-bold">{notification.message}</span>
                        </div>
                    )}

                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-borderSlate pb-4 gap-2">
                        <div>
                            <h2 className="text-base md:text-lg font-bold text-white flex items-center gap-2">
                                <i className="fa-solid fa-map-location-dot text-brandBlue"></i>
                                Manage Network Locations
                            </h2>
                            <p className="text-[11px] text-slate-400 mt-1">Register new warehouses and delivery cities independently into the logistics grid.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* WAREHOUSE REGISTER/EDIT FORM */}
                        <div className={`bg-panelBg border rounded-xl p-5 shadow-xl flex flex-col justify-between transition-colors ${
                            editingWarehouse ? "border-brandBlue/50 bg-slate-900/40" : "border-borderSlate"
                        }`}>
                            <div>
                                <h3 className="text-sm font-bold text-white border-b border-borderSlate/60 pb-2 mb-4 flex items-center gap-2">
                                    <i className="fa-solid fa-warehouse text-brandBlue"></i>
                                    {editingWarehouse ? `Edit Warehouse: ${editingWarehouse.originalName}` : "Register New Warehouse"}
                                </h3>
                                <form onSubmit={submitWarehouse} className="space-y-4">
                                    <div>
                                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">Warehouse Name</label>
                                        <input 
                                            type="text"
                                            value={wName}
                                            onChange={(e) => setWName(e.target.value)}
                                            placeholder="e.g. Ranchi DC"
                                            className="w-full bg-slate-900 border border-borderSlate rounded px-3 py-2 text-xs text-white outline-none focus:border-brandBlue transition"
                                            required
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">Latitude</label>
                                            <input 
                                                type="number"
                                                step="any"
                                                value={wLat}
                                                onChange={(e) => setWLat(e.target.value)}
                                                placeholder="e.g. 23.3441"
                                                className="w-full bg-slate-900 border border-borderSlate rounded px-3 py-2 text-xs text-white outline-none focus:border-brandBlue transition"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">Longitude</label>
                                            <input 
                                                type="number"
                                                step="any"
                                                value={wLon}
                                                onChange={(e) => setWLon(e.target.value)}
                                                placeholder="e.g. 85.3096"
                                                className="w-full bg-slate-900 border border-borderSlate rounded px-3 py-2 text-xs text-white outline-none focus:border-brandBlue transition"
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="flex gap-3 mt-4">
                                        {editingWarehouse && (
                                            <button 
                                                type="button"
                                                onClick={cancelEditWarehouse}
                                                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs py-2 rounded shadow transition duration-200 active:scale-98 cursor-pointer"
                                            >
                                                Cancel
                                            </button>
                                        )}
                                        <button 
                                            type="submit"
                                            className="flex-2 bg-brandBlue hover:bg-brandBlue/90 text-white font-bold text-xs py-2 rounded shadow-md hover:shadow-brandBlue/20 transition duration-200 active:scale-98 cursor-pointer"
                                        >
                                            {editingWarehouse ? "Save Changes" : "Add Warehouse"}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>

                        {/* CITY REGISTER/EDIT FORM */}
                        <div className={`bg-panelBg border rounded-xl p-5 shadow-xl flex flex-col justify-between transition-colors ${
                            editingCity ? "border-statusGreen/50 bg-slate-900/40" : "border-borderSlate"
                        }`}>
                            <div>
                                <h3 className="text-sm font-bold text-white border-b border-borderSlate/60 pb-2 mb-4 flex items-center gap-2">
                                    <i className="fa-solid fa-city text-statusGreen"></i>
                                    {editingCity ? `Edit Delivery City: ${editingCity.originalCity}` : "Register New Delivery City (Hub)"}
                                </h3>
                                <form onSubmit={submitCity} className="space-y-4">
                                    <div>
                                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">City Name (with State)</label>
                                        <input 
                                            type="text"
                                            value={cName}
                                            onChange={(e) => setCName(e.target.value)}
                                            placeholder="e.g. Ranchi, JH"
                                            className="w-full bg-slate-900 border border-borderSlate rounded px-3 py-2 text-xs text-white outline-none focus:border-statusGreen transition"
                                            required
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">Latitude</label>
                                            <input 
                                                type="number"
                                                step="any"
                                                value={cLat}
                                                onChange={(e) => setCLat(e.target.value)}
                                                placeholder="e.g. 23.3441"
                                                className="w-full bg-slate-900 border border-borderSlate rounded px-3 py-2 text-xs text-white outline-none focus:border-statusGreen transition"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">Longitude</label>
                                            <input 
                                                type="number"
                                                step="any"
                                                value={cLon}
                                                onChange={(e) => setCLon(e.target.value)}
                                                placeholder="e.g. 85.3096"
                                                className="w-full bg-slate-900 border border-borderSlate rounded px-3 py-2 text-xs text-white outline-none focus:border-statusGreen transition"
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="flex gap-3 mt-4">
                                        {editingCity && (
                                            <button 
                                                type="button"
                                                onClick={cancelEditCity}
                                                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs py-2 rounded shadow transition duration-200 active:scale-98 cursor-pointer"
                                            >
                                                Cancel
                                            </button>
                                        )}
                                        <button 
                                            type="submit"
                                            className="flex-2 bg-statusGreen hover:bg-statusGreen/90 text-white font-bold text-xs py-2 rounded shadow-md hover:shadow-statusGreen/20 transition duration-200 active:scale-98 cursor-pointer"
                                        >
                                            {editingCity ? "Save Changes" : "Add Delivery City"}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>

                    {/* LIST OF REGISTERED WAREHOUSES & CITIES */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* WAREHOUSE LIST */}
                        <div className="bg-panelBg border border-borderSlate rounded-xl p-4 shadow-xl">
                            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                <i className="fa-solid fa-list text-brandBlue"></i>
                                Registered Warehouses ({Object.keys(warehouses).length})
                            </h4>
                            <div className="overflow-x-auto max-h-60 custom-scrollbar">
                                <table className="w-full text-left text-[11px]">
                                    <thead>
                                        <tr className="text-slate-500 border-b border-borderSlate uppercase font-bold text-[10px]">
                                            <th className="pb-2">Name</th>
                                            <th className="pb-2">Coordinates</th>
                                            <th className="pb-2 text-right">Weather</th>
                                            <th className="pb-2 w-16 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-borderSlate/30">
                                        {Object.values(warehouses).map((w, idx) => {
                                            const wWeather = weatherData[w.name];
                                            const temp = wWeather && wWeather.temp !== null ? `${Math.round(wWeather.temp)}°C` : "--";
                                            const desc = wWeather ? wWeather.description : "Loading...";
                                            const icon = wWeather ? wWeather.icon : "fa-spinner animate-spin text-brandBlue";
                                            
                                            return (
                                                <tr key={idx} className="hover:bg-slate-800/20">
                                                    <td className="py-2.5 font-bold text-white">{w.name}</td>
                                                    <td className="py-2.5 font-mono text-slate-400">{w.lat.toFixed(4)}, {w.lon.toFixed(4)}</td>
                                                    <td className="py-2.5 text-right flex items-center justify-end gap-1.5">
                                                        <i className={`fa-solid ${icon} text-[10px] text-slate-400`}></i>
                                                        <span className="font-semibold text-slate-300">{temp}</span>
                                                    </td>
                                                    <td className="py-2.5 text-right">
                                                        <button 
                                                            onClick={() => startEditWarehouse(w)}
                                                            className="px-2 py-0.5 bg-slate-900 hover:bg-slate-800 border border-borderSlate hover:border-slate-600 rounded text-slate-300 hover:text-white transition cursor-pointer text-[9px] font-bold"
                                                            title={`Edit details for ${w.name}`}
                                                        >
                                                            <i className="fa-solid fa-pen-to-square text-[9px] mr-1 text-brandBlue"></i> Edit
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* CITY LIST */}
                        <div className="bg-panelBg border border-borderSlate rounded-xl p-4 shadow-xl">
                            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                <i className="fa-solid fa-list text-statusGreen"></i>
                                Delivery Cities ({Object.keys(hubsCoords).length})
                            </h4>
                            <div className="overflow-x-auto max-h-60 custom-scrollbar">
                                <table className="w-full text-left text-[11px]">
                                    <thead>
                                        <tr className="text-slate-500 border-b border-borderSlate uppercase font-bold text-[10px]">
                                            <th className="pb-2">City</th>
                                            <th className="pb-2">Coordinates</th>
                                            <th className="pb-2 text-right">Weather / AQI</th>
                                            <th className="pb-2 w-16 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-borderSlate/30">
                                        {Object.keys(hubsCoords).map((city, idx) => {
                                            const cCoords = hubsCoords[city];
                                            const cWeather = weatherData[city];
                                            const temp = cWeather && cWeather.temp !== null ? `${Math.round(cWeather.temp)}°C` : "--";
                                            const cAqi = aqiData[city];
                                            const aqiVal = cAqi && cAqi.aqi !== null ? `${cAqi.aqi} AQI` : "--";
                                            const aqiColor = cAqi && cAqi.aqi !== null ? (cAqi.aqi > 150 ? 'text-statusRed' : (cAqi.aqi > 100 ? 'text-statusOrange' : 'text-statusGreen')) : 'text-slate-500';
                                            
                                            return (
                                                <tr key={idx} className="hover:bg-slate-800/20">
                                                    <td className="py-2.5 font-bold text-white">{city}</td>
                                                    <td className="py-2.5 font-mono text-slate-400">{cCoords.lat.toFixed(4)}, {cCoords.lon.toFixed(4)}</td>
                                                    <td className="py-2.5 text-right font-semibold text-slate-300">
                                                        <span>{temp}</span>
                                                        <span className="mx-1.5 text-slate-600">|</span>
                                                        <span className={aqiColor}>{aqiVal}</span>
                                                    </td>
                                                    <td className="py-2.5 text-right">
                                                        <button 
                                                            onClick={() => startEditCity(city, cCoords)}
                                                            className="px-2 py-0.5 bg-slate-900 hover:bg-slate-800 border border-borderSlate hover:border-slate-600 rounded text-slate-300 hover:text-white transition cursor-pointer text-[9px] font-bold"
                                                            title={`Edit details for ${city}`}
                                                        >
                                                            <i className="fa-solid fa-pen-to-square text-[9px] mr-1 text-statusGreen"></i> Edit
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            );
        };

        // --- REGISTER ORDER VIEW ---
        const CreateOrderView = ({ warehouses, hubsCoords, weatherData, aqiData, tomtomTrafficData, newsAlerts, onAddOrder, setActiveTab }) => {
            const generateRandomOrderID = () => `DLV-${Math.floor(10000 + Math.random() * 90000)}`;

            const [orderID, setOrderID] = useState(generateRandomOrderID());
            const [sourceWarehouse, setSourceWarehouse] = useState("Patna HQ DC");
            const [routeHub, setRouteHub] = useState("");
            const [volume, setVolume] = useState("500");
            const [status, setStatus] = useState("");
            const [orderDate, setOrderDate] = useState(() => {
                const now = new Date();
                const yyyy = now.getFullYear();
                const mm = String(now.getMonth() + 1).padStart(2, '0');
                const dd = String(now.getDate()).padStart(2, '0');
                return `${yyyy}-${mm}-${dd}`;
            });
            const [altPath, setAltPath] = useState("Standard Routing");

            const [notification, setNotification] = useState(null);
            const [submitting, setSubmitting] = useState(false);

            const showNotification = (message, type = "success") => {
                setNotification({ message, type });
                setTimeout(() => setNotification(null), 4000);
            };

            // Calculate live route delays helper
            const getLiveDelays = (hubName, orderId, lat, lon) => {
                const wWeather = weatherData[hubName] || { delay: 0, description: "Clear weather" };
                const weatherDelay = wWeather.delay || 0;
                const weatherDesc = wWeather.description || "Clear";

                const cAqi = aqiData[hubName] || { delay: 0, description: "Healthy Air", aqi: null };
                const aqiDelay = cAqi.delay || 0;
                const aqiDesc = cAqi.description || "Healthy Air";

                let trafficDelay = 0;
                let trafficReason = "Optimal Traffic Flow";
                const liveTraffic = tomtomTrafficData[hubName];
                if (liveTraffic) {
                    trafficDelay = liveTraffic.delayMins;
                    if (trafficDelay > 30) {
                        trafficReason = `Severe Congestion (+${trafficDelay}m)`;
                    } else if (trafficDelay > 15) {
                        trafficReason = `Moderate Congestion (+${trafficDelay}m)`;
                    } else {
                        trafficReason = `Free Flow Traffic`;
                    }
                } else {
                    const timeIndex = Math.floor(Date.now() / (600 * 1000));
                    let hash = timeIndex;
                    for (let i = 0; i < hubName.length; i++) hash += hubName.charCodeAt(i);
                    for (let i = 0; i < orderId.length; i++) hash += orderId.charCodeAt(i);
                    const severity = hash % 10;
                    if (severity === 9) {
                        trafficDelay = 45 + (hash % 15);
                        trafficReason = `NH Highway Accident (+${trafficDelay}m)`;
                    } else if (severity >= 7) {
                        trafficDelay = 20 + (hash % 15);
                        trafficReason = `Highway Maintenance (+${trafficDelay}m)`;
                    } else if (severity >= 4) {
                        trafficDelay = 8 + (hash % 10);
                        trafficReason = `Peak Hour Congestion (+${trafficDelay}m)`;
                    } else {
                        trafficDelay = 2 + (hash % 4);
                        trafficReason = `Optimal Highway Speed`;
                    }
                }

                let newsDelay = 0;
                let newsReason = "";
                const matchingNews = newsAlerts.filter(n => n.hub === hubName);
                if (matchingNews.length > 0) {
                    const maxNewsAlert = matchingNews.reduce((max, cur) => cur.delay > max.delay ? cur : max, matchingNews[0]);
                    newsDelay = maxNewsAlert.delay;
                    newsReason = `[Disruption] ${maxNewsAlert.title} (+${newsDelay}m)`;
                }

                const totalDelay = weatherDelay + trafficDelay + newsDelay + aqiDelay;
                const reasons = [];
                if (weatherDelay > 0) reasons.push(weatherDesc);
                if (trafficDelay > 0) reasons.push(trafficReason);
                if (newsDelay > 0) reasons.push(newsReason);
                if (aqiDelay > 0) reasons.push(aqiDesc);
                const reason = reasons.length > 0 ? reasons.join(" & ") : "Clear & Optimal";

                return {
                    weatherDelay,
                    weatherDesc,
                    aqiDelay,
                    aqiDesc,
                    trafficDelay,
                    trafficReason,
                    newsDelay,
                    newsReason,
                    totalDelay,
                    reason
                };
            };

            useEffect(() => {
                const hubs = Object.keys(hubsCoords);
                if (hubs.length > 0 && !routeHub) {
                    setRouteHub(hubs[0]);
                }
            }, [hubsCoords]);

            const origin = warehouses[sourceWarehouse] || warehouses["Patna HQ DC"];
            const dest = hubsCoords[routeHub] || (routeHub ? { lat: 0, lon: 0 } : null);

            let distance = 0;
            let baselineHours = 0;
            let liveDelays = { weatherDelay: 0, weatherDesc: "Clear", aqiDelay: 0, aqiDesc: "Healthy Air", trafficDelay: 0, trafficReason: "Optimal", newsDelay: 0, newsReason: "", totalDelay: 0, reason: "Clear" };

            if (origin && dest && routeHub) {
                distance = haversineDistance(origin.lat, origin.lon, dest.lat, dest.lon);
                
                if (sourceWarehouse === "Patna HQ DC" && SCM_BASELINES[routeHub]) {
                    baselineHours = SCM_BASELINES[routeHub].baselineHours;
                } else {
                    baselineHours = Math.round((distance / 35.0 + 2.0) * 10) / 10;
                }

                liveDelays = getLiveDelays(routeHub, orderID, dest.lat, dest.lon);
            }

            const totalDelay = liveDelays.totalDelay;
            const delayedHours = baselineHours + (totalDelay / 60.0);
            
            const suggestedStatus = totalDelay > 60 ? "Delayed" : (totalDelay > 20 ? "At Risk" : "In Transit");
            const activeStatus = status || suggestedStatus;

            const eta = generateETA(orderDate, Math.round(delayedHours * 60));

            const volNum = parseFloat(volume) || 0;
            const costPerMinute = volNum * 0.15 + 12;
            const financialImpact = totalDelay > 0 ? Math.round(totalDelay * costPerMinute) : 0;

            const submitOrder = async (e) => {
                e.preventDefault();
                if (!orderID.trim() || !sourceWarehouse || !routeHub || !volume || !orderDate) {
                    showNotification("Please fill in all order details", "error");
                    return;
                }

                setSubmitting(true);
                const orderData = {
                    OrderID: orderID.trim(),
                    SourceWarehouse: sourceWarehouse,
                    RouteHub: routeHub,
                    Latitude: dest.lat,
                    Longitude: dest.lon,
                    Volume: parseFloat(volume),
                    Status: activeStatus,
                    Reason: liveDelays.reason,
                    BaselineTime: baselineHours,
                    DelayTime: totalDelay,
                    DelayedTime: delayedHours,
                    ETA: eta,
                    AltPath: altPath,
                    FinancialImpact: financialImpact,
                    OrderDate: orderDate
                };

                try {
                    await onAddOrder(orderData);
                    showNotification(`Order "${orderID}" added successfully!`);
                    
                    setOrderID(generateRandomOrderID());
                    setVolume("500");
                    setStatus("");
                    setAltPath("Standard Routing");
                    
                    setTimeout(() => {
                        setActiveTab("overview");
                    }, 1000);
                } catch (err) {
                    showNotification("Failed to add order to database", "error");
                } finally {
                    setSubmitting(false);
                }
            };

            return (
                <div className="flex-1 p-6 overflow-y-auto space-y-6 custom-scrollbar text-slate-300 font-sans bg-darkBg">
                    {notification && (
                        <div className={`fixed top-4 right-4 z-[10000] p-4 rounded-xl border flex items-center gap-3 shadow-2xl transition-all duration-300 ${
                            notification.type === "success" 
                                ? "bg-emerald-950/90 text-statusGreen border-statusGreen/30 animate-bounce" 
                                : "bg-red-950/90 text-statusRed border-statusRed/30"
                        }`}>
                            <i className={`fa-solid ${notification.type === "success" ? "fa-circle-check" : "fa-circle-exclamation"} text-lg`}></i>
                            <span className="text-xs font-bold">{notification.message}</span>
                        </div>
                    )}

                    <div className="flex justify-between items-center border-b border-borderSlate pb-4">
                        <div>
                            <h2 className="text-base md:text-lg font-bold text-white flex items-center gap-2">
                                <i className="fa-solid fa-file-circle-plus text-brandBlue"></i>
                                Register New Order
                            </h2>
                            <p className="text-[11px] text-slate-400 mt-1">Accept order details from the user, calculate delivery metrics in real-time, and store the record in the backend Excel database.</p>
                        </div>
                        <button 
                            onClick={() => setActiveTab("overview")}
                            className="bg-slate-900 border border-borderSlate text-[11px] font-bold px-3 py-1.5 rounded hover:text-white transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                        >
                            <i className="fa-solid fa-arrow-left"></i>
                            Back to Overview
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* FORM PANEL */}
                        <div className="lg:col-span-2 bg-panelBg border border-borderSlate rounded-xl p-5 shadow-xl">
                            <h3 className="text-sm font-bold text-white border-b border-borderSlate/60 pb-2 mb-4 flex items-center gap-2">
                                <i className="fa-solid fa-file-invoice text-brandBlue"></i>
                                Order Specification Form
                            </h3>
                            <form onSubmit={submitOrder} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">Order ID</label>
                                        <div className="flex gap-2">
                                            <input 
                                                type="text"
                                                value={orderID}
                                                onChange={(e) => setOrderID(e.target.value)}
                                                className="w-full bg-slate-900 border border-borderSlate rounded px-3 py-2 text-xs text-white font-mono outline-none focus:border-brandBlue transition"
                                                required
                                            />
                                            <button 
                                                type="button"
                                                onClick={() => setOrderID(generateRandomOrderID())}
                                                className="px-3 bg-slate-900 border border-borderSlate hover:border-slate-500 rounded text-slate-300 hover:text-white transition cursor-pointer active:scale-90"
                                                title="Regenerate Order ID"
                                            >
                                                <i className="fa-solid fa-arrows-rotate"></i>
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">Order Date</label>
                                        <input 
                                            type="date"
                                            value={orderDate}
                                            onChange={(e) => setOrderDate(e.target.value)}
                                            className="w-full bg-slate-900 border border-borderSlate rounded px-3 py-2 text-xs text-white outline-none focus:border-brandBlue transition"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">Source Warehouse</label>
                                        <select 
                                            value={sourceWarehouse}
                                            onChange={(e) => setSourceWarehouse(e.target.value)}
                                            className="w-full bg-slate-900 border border-borderSlate rounded px-3 py-2 text-xs text-white outline-none focus:border-brandBlue transition"
                                        >
                                            {Object.keys(warehouses).map(name => (
                                                <option key={name} value={name}>{name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">Destination Delivery City (Hub)</label>
                                        <select 
                                            value={routeHub}
                                            onChange={(e) => setRouteHub(e.target.value)}
                                            className="w-full bg-slate-900 border border-borderSlate rounded px-3 py-2 text-xs text-white outline-none focus:border-brandBlue transition"
                                            required
                                        >
                                            {Object.keys(hubsCoords).map(city => (
                                                <option key={city} value={city}>{city}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">Cargo Volume (kg)</label>
                                        <input 
                                            type="number"
                                            value={volume}
                                            onChange={(e) => setVolume(e.target.value)}
                                            placeholder="e.g. 500"
                                            className="w-full bg-slate-900 border border-borderSlate rounded px-3 py-2 text-xs text-white outline-none focus:border-brandBlue transition"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">Route Configuration</label>
                                        <select 
                                            value={altPath}
                                            onChange={(e) => setAltPath(e.target.value)}
                                            className="w-full bg-slate-900 border border-borderSlate rounded px-3 py-2 text-xs text-white outline-none focus:border-brandBlue transition"
                                        >
                                            <option value="Standard Routing">Standard Routing</option>
                                            <option value="Alternative Route A">Alternative Route A</option>
                                            <option value="Alternative Route B">Alternative Route B</option>
                                            <option value="Alternative Route C">Alternative Route C</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">
                                            Status Override
                                            <span className="text-[8px] text-slate-500 font-normal ml-1">(Optional - Defaults to suggested)</span>
                                        </label>
                                        <select 
                                            value={status}
                                            onChange={(e) => setStatus(e.target.value)}
                                            className="w-full bg-slate-900 border border-borderSlate rounded px-3 py-2 text-xs text-white outline-none focus:border-brandBlue transition"
                                        >
                                            <option value="">Auto-Suggest ({suggestedStatus})</option>
                                            <option value="In Transit">In Transit</option>
                                            <option value="Delayed">Delayed</option>
                                            <option value="At Risk">At Risk</option>
                                            <option value="Delivered">Delivered</option>
                                        </select>
                                    </div>
                                </div>

                                <button 
                                    type="submit"
                                    disabled={submitting}
                                    className="w-full bg-brandBlue hover:bg-brandBlue/90 disabled:bg-slate-800 text-white font-bold text-xs py-2.5 rounded shadow-lg hover:shadow-brandBlue/20 transition duration-200 active:scale-98 cursor-pointer mt-6 flex items-center justify-center gap-2"
                                >
                                    {submitting ? (
                                        <>
                                            <i className="fa-solid fa-spinner animate-spin"></i>
                                            Saving Order to Excel database...
                                        </>
                                    ) : (
                                        <>
                                            <i className="fa-solid fa-cloud-arrow-up"></i>
                                            Register & Persist Order
                                        </>
                                    )}
                                </button>
                            </form>
                        </div>

                        {/* LIVE CALCULATION SUMMARY PANEL */}
                        <div className="bg-panelBg border border-borderSlate rounded-xl p-5 shadow-xl flex flex-col justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-white border-b border-borderSlate/60 pb-2 mb-4 flex items-center gap-2">
                                    <i className="fa-solid fa-calculator text-statusOrange"></i>
                                    Route Summary & Logistics Preview
                                </h3>
                                
                                {routeHub ? (
                                    <div className="space-y-4 text-xs">
                                        <div className="flex justify-between items-center bg-slate-900/40 p-2.5 rounded border border-borderSlate/40">
                                            <span className="text-slate-400">Total Route Distance</span>
                                            <span className="font-bold text-white font-mono text-right">{distance.toFixed(1)} km</span>
                                        </div>

                                        <div className="space-y-2.5">
                                            <h4 className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Transit Calculations</h4>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">Baseline Transit Time</span>
                                                <span className="font-semibold text-slate-200">{baselineHours.toFixed(1)} hrs</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">Calculated Delay Time</span>
                                                <span className={`font-bold font-mono ${totalDelay > 0 ? 'text-statusRed animate-pulse' : 'text-statusGreen'}`}>
                                                    +{totalDelay} mins
                                                </span>
                                            </div>
                                            <div className="flex justify-between border-t border-borderSlate/20 pt-2 font-bold">
                                                <span className="text-slate-300">Total Delayed Transit Time</span>
                                                <span className="text-white font-mono">{delayedHours.toFixed(1)} hrs</span>
                                            </div>
                                        </div>

                                        <div className="space-y-2 border-t border-borderSlate/20 pt-3">
                                            <h4 className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Delay Component Breakdown</h4>
                                            
                                            <div className="flex justify-between text-[11px]">
                                                <span className="flex items-center gap-1.5 text-slate-400">
                                                    <i className="fa-solid fa-cloud-sun text-brandBlue w-3.5"></i> Weather Delay
                                                </span>
                                                <span className="text-slate-300 font-semibold font-mono">+{liveDelays.weatherDelay}m</span>
                                            </div>

                                            <div className="flex justify-between text-[11px]">
                                                <span className="flex items-center gap-1.5 text-slate-400">
                                                    <i className="fa-solid fa-car text-statusOrange w-3.5"></i> Traffic Delay
                                                </span>
                                                <span className="text-slate-300 font-semibold font-mono">+{liveDelays.trafficDelay}m</span>
                                            </div>

                                            <div className="flex justify-between text-[11px]">
                                                <span className="flex items-center gap-1.5 text-slate-400">
                                                    <i className="fa-solid fa-smog text-statusPurple w-3.5"></i> AQI Delay
                                                </span>
                                                <span className="text-slate-300 font-semibold font-mono">+{liveDelays.aqiDelay}m</span>
                                            </div>

                                            <div className="flex justify-between text-[11px]">
                                                <span className="flex items-center gap-1.5 text-slate-400">
                                                    <i className="fa-solid fa-newspaper text-slate-500 w-3.5"></i> Disruption Delay
                                                </span>
                                                <span className="text-slate-300 font-semibold font-mono">+{liveDelays.newsDelay}m</span>
                                            </div>
                                        </div>

                                        <div className="space-y-2 border-t border-borderSlate/20 pt-3">
                                            <h4 className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Suggested Status & ETA</h4>
                                            <div className="flex justify-between items-center">
                                                <span className="text-slate-400">Status Categorization</span>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                                                    activeStatus === "Delayed" 
                                                        ? "bg-red-950/60 text-statusRed border-statusRed/30" 
                                                        : (activeStatus === "At Risk" 
                                                            ? "bg-amber-950/60 text-statusOrange border-statusOrange/30" 
                                                            : "bg-emerald-950/60 text-statusGreen border-statusGreen/30")
                                                }`}>
                                                    {activeStatus}
                                                </span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">Calculated ETA</span>
                                                <span className="font-bold text-white font-mono">{eta}</span>
                                            </div>
                                        </div>

                                        <div className="space-y-2 border-t border-borderSlate/20 pt-3 bg-slate-900/30 p-2.5 rounded border border-borderSlate/20">
                                            <h4 className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Financial Impact Forecast</h4>
                                            <div className="flex justify-between items-center">
                                                <span className="text-slate-400 text-[11px]">Estimated Delay Penalty</span>
                                                <span className={`text-sm font-black font-mono ${financialImpact > 0 ? 'text-statusRed' : 'text-statusGreen'}`}>
                                                    ₹{financialImpact.toLocaleString('en-IN')}
                                                </span>
                                            </div>
                                            <p className="text-[9px] text-slate-500 italic mt-0.5 leading-relaxed">
                                                Based on cost formula: ₹{costPerMinute.toFixed(2)}/min for {volNum} kg volume cargo.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center text-xs text-slate-500 italic py-12">
                                        Select a delivery city to view route metrics preview.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            );
        };

        // --- MAIN APP IMPLEMENTATION ---
        const App = () => {
            const mapRef = useRef(null);
            const mapLayersRef = useRef(null);
            const thermalLayerRef = useRef(null);
            const updateThermalOverlayRef = useRef(null);
            const donutChartRef = useRef(null);
            const donutChartInstanceRef = useRef(null);
            const barChartRef = useRef(null);
            const barChartInstanceRef = useRef(null);

            const [activeTab, setActiveTab] = useState("overview");
            const [warehouses, setWarehouses] = useState({ "Patna HQ DC": { name: "Patna HQ DC", lat: 25.5941, lon: 85.1376 } });
            const [rawOrders, setRawOrders] = useState([]);
            const [historicalWeatherData, setHistoricalWeatherData] = useState({});
            const [tomtomTrafficData, setTomtomTrafficData] = useState({});
            const [hubsCoords, setHubsCoords] = useState({});
            const [orders, setOrders] = useState([]);
            const [newsAlerts, setNewsAlerts] = useState([]);
            const [aqiData, setAqiData] = useState({});

            const [routeNetwork, setRouteNetwork] = useState([]);
            const [theme, setTheme] = useState(() => {
                return localStorage.getItem("scm_theme") || "dark";
            });

            useEffect(() => {
                document.documentElement.setAttribute("data-theme", theme);
            }, [theme]);

            const toggleTheme = () => {
                setTheme(prev => {
                    const next = prev === "dark" ? "light" : "dark";
                    localStorage.setItem("scm_theme", next);
                    return next;
                });
            };

            const [loading, setLoading] = useState(true);
            const [loadingStage, setLoadingStage] = useState("Initializing database...");
            const [weatherData, setWeatherData] = useState({});
            const [hqWeather, setHqWeather] = useState("Loading...");
            const [weatherScenario, setWeatherScenario] = useState("live");
            const [showThermalMap, setShowThermalMap] = useState(true);
            const [systemTime, setSystemTime] = useState("");
            const [refreshTimer, setRefreshTimer] = useState(600);
            const [settingsOpen, setSettingsOpen] = useState(false);
            
            const getFormattedDateTime = () => {
                const now = new Date();
                return now.toLocaleString('en-IN', { hour12: true });
            };
            const [lastFetchTime, setLastFetchTime] = useState(getFormattedDateTime());
            const [isRefreshing, setIsRefreshing] = useState(false);
            
            // Individual API Fetch Timestamps & States
            const [lastOrdersFetch, setLastOrdersFetch] = useState(getFormattedDateTime());
            const [lastTrafficFetch, setLastTrafficFetch] = useState(getFormattedDateTime());
            const [lastWeatherFetch, setLastWeatherFetch] = useState(getFormattedDateTime());
            const [lastAqiFetch, setLastAqiFetch] = useState(getFormattedDateTime());
            const [lastNewsFetch, setLastNewsFetch] = useState(getFormattedDateTime());
            
            const [refreshingOrders, setRefreshingOrders] = useState(false);
            const [refreshingTraffic, setRefreshingTraffic] = useState(false);
            const [refreshingWeather, setRefreshingWeather] = useState(false);
            const [refreshingAqi, setRefreshingAqi] = useState(false);
            const [refreshingNews, setRefreshingNews] = useState(false);
            
            const [apiPanelOpen, setApiPanelOpen] = useState(false);
            
            // API key input states
            const [apiKeyInput, setApiKeyInput] = useState(localStorage.getItem('openweathermap_api_key') || "000bd6759eb2260d3900697d8faf36fd");
            const [weatherApiKeyInput, setWeatherApiKeyInput] = useState(localStorage.getItem('weatherapi_api_key') || "");
            const [tomtomApiKeyInput, setTomtomApiKeyInput] = useState(localStorage.getItem('tomtom_api_key') || "");
            const [visualCrossingApiKeyInput, setVisualCrossingApiKeyInput] = useState(localStorage.getItem('visualcrossing_api_key') || "");
            const [waqiApiKeyInput, setWaqiApiKeyInput] = useState(localStorage.getItem('waqi_api_key') || "");
            
            // Telemetry integration states
            const [weatherSourceString, setWeatherSourceString] = useState("Weather Feed (Cascade)");
            const [isOwmFallback, setIsOwmFallback] = useState(false);

            const saveConfigurations = async (owmKey, weatherKey, tomtomKey, vcKey, waqiKey) => {
                const trimmedOwm = (owmKey || "").trim();
                const trimmedWeather = (weatherKey || "").trim();
                const trimmedTomtom = (tomtomKey || "").trim();
                const trimmedVc = (vcKey || "").trim();
                const trimmedWaqi = (waqiKey || "").trim();

                localStorage.setItem('openweathermap_api_key', trimmedOwm);
                localStorage.setItem('weatherapi_api_key', trimmedWeather);
                localStorage.setItem('tomtom_api_key', trimmedTomtom);
                localStorage.setItem('visualcrossing_api_key', trimmedVc);
                localStorage.setItem('waqi_api_key', trimmedWaqi);

                try {
                    await fetch("/api/keys", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            openweathermap: trimmedOwm,
                            weatherapi: trimmedWeather,
                            tomtom: trimmedTomtom,
                            visualcrossing: trimmedVc,
                            waqi: trimmedWaqi
                        })
                    });
                } catch (err) {
                    console.error("Failed to save API keys to server:", err);
                }

                setApiKeyInput(trimmedOwm);
                setWeatherApiKeyInput(trimmedWeather);
                setTomtomApiKeyInput(trimmedTomtom);
                setVisualCrossingApiKeyInput(trimmedVc);
                setWaqiApiKeyInput(trimmedWaqi);
                setSettingsOpen(false);
                if (Object.keys(hubsCoords).length > 0) {
                    setLoadingStage("Refreshing dashboard configurations and live feeds...");
                    await fetchTrafficData(hubsCoords);
                    await fetchWeatherDataAndAqiAndNews(hubsCoords, true);
                }
            };
            
            const [kpiData, setKpiData] = useState({
                total: "0",
                onTime: "0.0%",
                delayed: "0",
                atRisk: "0",
                weather: "0",
                financial: "₹0"
            });
            const [statusCounts, setStatusCounts] = useState([0, 0, 0, 0]);
            const [financialOverheadTrend, setFinancialOverheadTrend] = useState([]);
            const [recentDelays, setRecentDelays] = useState([]);
            const [hoveredDelay, setHoveredDelay] = useState(null);
            const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
            const [weatherCounts, setWeatherCounts] = useState(0);
            const [trafficCounts, setTrafficCounts] = useState(0);

            const fitAllMarkers = () => {
                if (mapRef.current && (routeNetwork.length > 0 || Object.keys(warehouses).length > 0)) {
                    const points = [
                        ...Object.values(warehouses).map(w => [w.lat, w.lon]),
                        ...routeNetwork.map(loc => [loc.lat, loc.lon])
                    ];
                    mapRef.current.fitBounds(points, { padding: [40, 40], animate: true });
                    setTimeout(() => {
                        if (mapRef.current) {
                            mapRef.current.invalidateSize();
                        }
                    }, 400);
                }
            };

            // Clock Effect to keep real-time date/time updated every second
            useEffect(() => {
                const updateClock = () => {
                    const now = new Date();
                    const optionsDate = { year: 'numeric', month: 'short', day: '2-digit' };
                    const formattedDate = now.toLocaleDateString('en-US', optionsDate);
                    
                    const optionsTime = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZoneName: 'short' };
                    const formattedTime = now.toLocaleTimeString('en-US', optionsTime);
                    
                    setSystemTime(`${formattedDate} | ${formattedTime}`);
                };
                updateClock();
                const clockInterval = setInterval(updateClock, 1000);
                return () => clearInterval(clockInterval);
            }, []);

            // Fetch live news using allorigins proxy or fallback to generated local alerts
            const fetchLiveNewsAlerts = async (currentHubs, activeWeatherData = null, activeAqiData = null) => {
                console.log("Fetching live logistics news...");
                
                // Get unique route hubs that have active orders (in transit, delayed, or at risk)
                // This ensures we only fetch news impacting routes currently under consideration
                let targetHubs = [];
                if (rawOrders && rawOrders.length > 0) {
                    targetHubs = Array.from(new Set(
                        rawOrders
                            .filter(o => o.Status === "In Transit" || o.Status === "Delayed" || o.Status === "At Risk")
                            .map(o => o.RouteHub)
                    ));
                }
                
                // If there are no active orders (e.g. initial load), fall back to all unique hubs in the dataset
                if (targetHubs.length === 0 && rawOrders && rawOrders.length > 0) {
                    targetHubs = Array.from(new Set(rawOrders.map(o => o.RouteHub)));
                }

                // If rawOrders is not populated yet, use all hubs as a bootstrap
                const hubsList = targetHubs.length > 0 ? targetHubs : (Object.keys(currentHubs).length > 0 ? Object.keys(currentHubs) : [
                    "Kolkata, WB", "Ranchi, JH", "Bhubaneswar, OD", "Siliguri, WB", "Guwahati, AS", 
                    "Jamshedpur, JH", "Patna, BR", "Gaya, BR", "Muzaffarpur, BR", "Bhagalpur, BR", 
                    "Dhanbad, JH", "Cuttack, OD", "Asansol, WB", "Durgapur, WB", "Darbhanga, BR", 
                    "Hazaribagh, JH", "Kharagpur, WB", "Shillong, ML", "Puri, OD"
                ]);

                // Determine transit cities path for each hub to search and monitor
                const getTransitCitiesForHub = (hub) => {
                    const cleanName = hub.split(",")[0].trim();
                    const transitMapping = {
                        "Kolkata": ["Patna", "Asansol", "Durgapur", "Kolkata"],
                        "Ranchi": ["Patna", "Gaya", "Hazaribagh", "Ranchi"],
                        "Bhubaneswar": ["Patna", "Kharagpur", "Cuttack", "Bhubaneswar"],
                        "Siliguri": ["Patna", "Bhagalpur", "Siliguri"],
                        "Guwahati": ["Patna", "Siliguri", "Guwahati"],
                        "Jamshedpur": ["Patna", "Gaya", "Hazaribagh", "Jamshedpur"],
                        "Gaya": ["Patna", "Gaya"],
                        "Muzaffarpur": ["Patna", "Muzaffarpur"],
                        "Bhagalpur": ["Patna", "Bhagalpur"],
                        "Dhanbad": ["Patna", "Gaya", "Dhanbad"],
                        "Cuttack": ["Patna", "Kharagpur", "Cuttack"],
                        "Asansol": ["Patna", "Gaya", "Asansol"],
                        "Durgapur": ["Patna", "Asansol", "Durgapur"],
                        "Darbhanga": ["Patna", "Muzaffarpur", "Darbhanga"],
                        "Hazaribagh": ["Patna", "Gaya", "Hazaribagh"],
                        "Kharagpur": ["Patna", "Asansol", "Kharagpur"],
                        "Shillong": ["Patna", "Siliguri", "Guwahati", "Shillong"],
                        "Puri": ["Patna", "Kharagpur", "Cuttack", "Bhubaneswar", "Puri"],
                        "Patna": ["Patna"]
                    };
                    return transitMapping[cleanName] || ["Patna", cleanName];
                };

                const allTransitCities = [];
                hubsList.forEach(hub => {
                    getTransitCitiesForHub(hub).forEach(city => {
                        if (!allTransitCities.includes(city)) {
                            allTransitCities.push(city);
                        }
                    });
                });

                const logisticsKeywords = [
                    "traffic", "protest", "strike", "accident", "flood", 
                    "storm", "blockage", "road", "highway", "rally", "delay", "landslide"
                ];

                const wData = (activeWeatherData && Object.keys(activeWeatherData).length > 0) ? activeWeatherData : weatherData;
                const aData = (activeAqiData && Object.keys(activeAqiData).length > 0) ? activeAqiData : aqiData;

                const generateWeatherAlertsForCities = (citiesToAlert, weatherMap, aqiMap) => {
                    const alerts = [];
                    const currentHour = new Date().getHours();
                    const daySeed = new Date().getDate();

                    citiesToAlert.forEach((cityName, idx) => {
                        const hubKey = Object.keys(currentHubs).find(key => key.toLowerCase().includes(cityName.toLowerCase())) || `${cityName}, BR`;
                        const hubData = weatherMap && weatherMap[hubKey];
                        const hubAqi = aqiMap && aqiMap[hubKey];
                        if (!hubData || hubData.temp === null || !hubAqi || hubAqi.aqi === null) return;

                        const temp = hubData.temp;
                        const rain = hubData.rain || 0;
                        const code = hubData.weathercode;
                        const wind = hubData.windspeed;
                        const aqi = hubAqi ? hubAqi.aqi : null;

                        let title = "";
                        let desc = "";
                        let icon = "fa-cloud-sun";
                        let risk = "Low";
                        let delay = 0;

                        if (code === 95 || code === 96 || code === 99) {
                            title = "Active Thunderstorm Warning";
                            desc = `Active thunderstorms reported in ${cityName}. Expected lightning and strong winds. Safe speeds active.`;
                            risk = "Critical";
                            icon = "fa-cloud-bolt";
                            delay = 110;
                        } else if (code === 45 || code === 48) {
                            title = "Fog / Low Visibility Warning";
                            desc = `Dense fog detected in ${cityName}. Visual range restricted on arterial routes. Speed caps applied.`;
                            risk = "High";
                            icon = "fa-smog";
                            delay = 45;
                        } else if (rain > 5) {
                            title = "Heavy Rainfall Warning";
                            desc = `Heavy precipitation of ${rain}mm recorded in ${cityName}. Increased braking distance and aquaplaning risk.`;
                            risk = "High";
                            icon = "fa-cloud-showers-heavy";
                            delay = rain > 15 ? 85 : 50;
                        } else if (temp > 35) {
                            title = "Extreme Temperature Warning";
                            desc = `High heat profile of ${temp}°C active in ${cityName}. Elevated engine and tire blowout stress warning.`;
                            risk = temp > 40 ? "Critical" : "High";
                            icon = "fa-temperature-high";
                            delay = Math.round(4.5 * (temp - 28));
                        } else if (wind > 35) {
                            title = "High Winds Transit Alert";
                            desc = `Sustained wind speeds of ${wind} km/h detected in ${cityName}. Elevated drift hazard for cargo trucks.`;
                            risk = "High";
                            icon = "fa-wind";
                            delay = Math.round(2.5 * (wind - 15));
                        } else if (aqi && aqi > 100) {
                            title = aqi > 150 ? "Severe Air Pollution Warning" : "Moderate Smog Warning";
                            desc = `Air Quality Index in ${cityName} is ${aqi} (Unhealthy). Smog conditions present on arterial highways.`;
                            risk = aqi > 150 ? "High" : "Medium";
                            icon = "fa-smog";
                            delay = aqi > 150 ? 30 : 15;
                        } else {
                            title = "Optimal Transit Weather";
                            desc = `Telemetry checks clear for ${cityName} corridor: ${temp}°C, AQI ${aqi || 70}, windspeed ${wind} km/h. Standard logistics flow.`;
                            risk = "Low";
                            icon = "fa-circle-check";
                            delay = 0;
                        }

                        alerts.push({
                            id: `telemetry-weather-alert-${cityName}-${idx}-${daySeed}`,
                            hub: hubKey,
                            title: title,
                            desc: `[Verified Live Status] ${desc} (Delay Impact: +${delay} mins)`,
                            risk: risk,
                            icon: icon,
                            link: "https://open-meteo.com",
                            delay: delay,
                            pubDate: new Date().toLocaleDateString() + ", " + ((currentHour + 24) % 24) + ":00"
                        });
                    });

                    return alerts;
                };

                try {
                    const searchNames = allTransitCities;
                    const query = `(${searchNames.join(" OR ")}) AND (traffic OR protest OR strike OR accident OR flood OR storm OR blockage OR road OR highway OR landslide OR rain)`;
                    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;
                    
                    const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(rssUrl)}`);
                    if (!response.ok) throw new Error("allorigins fetch failed");
                    
                    const data = await response.json();
                    if (!data.contents) throw new Error("allorigins empty contents");
                    
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(data.contents, "text/xml");
                    const items = xmlDoc.getElementsByTagName("item");
                    
                    const parsedAlerts = [];
                    
                    for (let i = 0; i < Math.min(items.length, 30); i++) {
                        const item = items[i];
                        const titleEl = item.getElementsByTagName("title")[0];
                        const linkEl = item.getElementsByTagName("link")[0];
                        const pubDateEl = item.getElementsByTagName("pubDate")[0];
                        const descEl = item.getElementsByTagName("description")[0];
                        
                        if (!titleEl) continue;
                        
                        const titleText = titleEl.textContent || "";
                        const linkText = linkEl ? (linkEl.textContent || "") : "https://news.google.com";
                        const pubDateText = pubDateEl ? (pubDateEl.textContent || "") : new Date().toLocaleString();
                        const descText = descEl ? (descEl.textContent || "") : "";
                        
                        const fullText = (titleText + " " + descText).toLowerCase();
                        
                        const hasLogisticsKeyword = logisticsKeywords.some(keyword => fullText.includes(keyword));
                        if (!hasLogisticsKeyword) continue;
                        
                        let matchedCity = null;
                        for (const cityName of allTransitCities) {
                            if (fullText.includes(cityName.toLowerCase())) {
                                matchedCity = cityName;
                                break;
                            }
                        }
                        
                        if (matchedCity) {
                            const cleanedTitle = titleText.replace(/\s+-\s+[^-\n]+$/, "");
                            const hubKey = Object.keys(currentHubs).find(key => key.toLowerCase().includes(matchedCity.toLowerCase())) || `${matchedCity}, BR`;
                            
                            let delay = 15;
                            let icon = "fa-triangle-exclamation";
                            let risk = "Medium";
                            
                            if (fullText.includes("protest") || fullText.includes("strike") || fullText.includes("rally") || fullText.includes("demonstration")) {
                                delay = 45;
                                icon = "fa-users";
                                risk = "High";
                            } else if (fullText.includes("accident") || fullText.includes("crash") || fullText.includes("collision")) {
                                delay = 30;
                                icon = "fa-car-burst";
                                risk = "High";
                            } else if (fullText.includes("block") || fullText.includes("closed") || fullText.includes("cutoff") || fullText.includes("shut")) {
                                delay = 60;
                                icon = "fa-ban";
                                risk = "Critical";
                            } else if (fullText.includes("flood") || fullText.includes("landslide") || fullText.includes("mudslide") || fullText.includes("waterlog")) {
                                delay = 55;
                                icon = "fa-water";
                                risk = "Critical";
                            } else if (fullText.includes("rain") || fullText.includes("storm") || fullText.includes("cyclone") || fullText.includes("gale")) {
                                delay = 35;
                                icon = "fa-cloud-showers-heavy";
                                risk = "High";
                            } else if (fullText.includes("traffic") || fullText.includes("jam") || fullText.includes("gridlock")) {
                                delay = 25;
                                icon = "fa-traffic-light";
                                risk = "Medium";
                            }
                            
                            parsedAlerts.push({
                                id: `news-${i}-${Date.now()}`,
                                hub: hubKey,
                                title: cleanedTitle,
                                desc: `[Live News] ${cleanedTitle} (Delay Impact: +${delay} mins)`,
                                risk: risk,
                                icon: icon,
                                link: linkText,
                                delay: delay,
                                pubDate: pubDateText
                            });
                        }
                    }
                    
                    if (parsedAlerts.length >= 10) {
                        console.log(`Successfully parsed ${parsedAlerts.length} live logistics news alerts!`);
                        setNewsAlerts(parsedAlerts.slice(0, 10));
                    } else {
                        console.log(`Parsed ${parsedAlerts.length} news alerts. Populating remaining slots with live weather alerts.`);
                        const existingNewsCities = parsedAlerts.map(a => a.hub.split(",")[0].trim().toLowerCase());
                        const remainingCities = allTransitCities.filter(c => !existingNewsCities.includes(c.toLowerCase()));
                        
                        const weatherAlerts = generateWeatherAlertsForCities(remainingCities.length > 0 ? remainingCities : allTransitCities, wData, aData);
                        const combined = [...parsedAlerts, ...weatherAlerts];
                        setNewsAlerts(combined.slice(0, 10));
                    }
                } catch (e) {
                    console.error("Failed to fetch live news from proxy, generating weather alerts:", e);
                    const weatherAlerts = generateWeatherAlertsForCities(allTransitCities, wData, aData);
                    setNewsAlerts(weatherAlerts.slice(0, 10));
                }
            };

            // Cache helpers for weather data to enforce once-per-hour-per-city query rate
            const getCachedWeather = (cityName) => {
                try {
                    const cacheStr = localStorage.getItem('scm_weather_cache');
                    if (!cacheStr) return null;
                    const cache = JSON.parse(cacheStr);
                    const entry = cache[cityName];
                    if (!entry) return null;
                    // check if fresh (less than 1 hour old)
                    if (Date.now() - entry.timestamp < 3600 * 1000) {
                        return entry;
                    }
                } catch (e) {
                    console.error("Error reading weather cache:", e);
                }
                return null;
            };

            const saveWeatherToCache = (cityName, weather, aqi, source) => {
                try {
                    const cacheStr = localStorage.getItem('scm_weather_cache') || '{}';
                    const cache = JSON.parse(cacheStr);
                    cache[cityName] = {
                        timestamp: Date.now(),
                        weather,
                        aqi,
                        source
                    };
                    localStorage.setItem('scm_weather_cache', JSON.stringify(cache));
                } catch (e) {
                    console.error("Error writing weather cache:", e);
                }
            };

            // Shared weather & AQI helper functions defined at component level
            const fetchOWM = async (city) => {
                const owmKey = (localStorage.getItem('openweathermap_api_key') || "000bd6759eb2260d3900697d8faf36fd").trim();
                const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${city.lat}&lon=${city.lon}&appid=${owmKey}&units=metric`;
                const aqiUrl = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${city.lat}&lon=${city.lon}&appid=${owmKey}`;
                const [wRes, aRes] = await Promise.all([fetch(weatherUrl), fetch(aqiUrl)]);
                if (!wRes.ok) {
                    throw new Error("OWM failed");
                }
                const wJson = await wRes.json();
                
                const main = wJson.main || {};
                const wind = wJson.wind || {};
                const weatherArr = wJson.weather || [];
                const rainObj = wJson.rain || {};
                
                const owmId = weatherArr[0] ? weatherArr[0].id : 800;
                let weathercode = 0;
                if (owmId >= 200 && owmId < 300) weathercode = 95;
                else if (owmId >= 300 && owmId < 400) weathercode = 53;
                else if (owmId >= 500 && owmId < 600) weathercode = 63;
                else if (owmId >= 700 && owmId < 800) weathercode = 45;
                else if (owmId === 800) weathercode = 0;
                else if (owmId > 800) weathercode = 2;

                const wData = {
                    temp: main.temp !== undefined ? main.temp : null,
                    windspeed: wind.speed !== undefined ? (wind.speed * 3.6) : null,
                    weathercode: weathercode,
                    rain: rainObj['1h'] || rainObj['3h'] || 0
                };

                let aData = { aqi: null, pm2_5: null, pm10: null };
                if (aRes.ok) {
                    const aJson = await aRes.json();
                    const list = aJson.list || [];
                    if (list[0]) {
                        const aMain = list[0].main || {};
                        const components = list[0].components || {};
                        const owmAqi = aMain.aqi;
                        const aqiMap = { 1: 25, 2: 75, 3: 125, 4: 175, 5: 250 };
                        aData = {
                            aqi: aqiMap[owmAqi] || 50,
                            pm2_5: components.pm2_5 || null,
                            pm10: components.pm10 || null
                        };
                    }
                }
                return { wData, aData };
            };

            const fetchWeatherAPI = async (city) => {
                const weatherApiKey = (localStorage.getItem('weatherapi_api_key') || "").trim();
                const url = `https://api.weatherapi.com/v1/current.json?key=${weatherApiKey}&q=${city.lat},${city.lon}&aqi=yes`;
                const res = await fetch(url);
                if (!res.ok) {
                    throw new Error("WeatherAPI failed");
                }
                const json = await res.json();
                const current = json.current || {};
                const condition = current.condition || {};
                const air = current.air_quality || {};

                const code = condition.code || 1000;
                let weathercode = 0;
                if (code === 1000) weathercode = 0;
                else if ([1003, 1006, 1009].includes(code)) weathercode = 2;
                else if ([1030, 1135, 1147].includes(code)) weathercode = 45;
                else if ([1063, 1150, 1153, 1180, 1183].includes(code)) weathercode = 53;
                else if ([1066, 1114, 1210, 1213, 1216, 1219, 1222, 1225, 1255, 1258].includes(code)) weathercode = 73;
                else if ([1087, 1273, 1276, 1279, 1282].includes(code)) weathercode = 95;
                else weathercode = 63;

                const wData = {
                    temp: current.temp_c !== undefined ? current.temp_c : null,
                    windspeed: current.wind_kph !== undefined ? current.wind_kph : null,
                    weathercode: weathercode,
                    rain: current.precip_mm || 0
                };

                const epaIndex = air['us-epa-index'] || 1;
                const aqiMap = { 1: 25, 2: 75, 3: 125, 4: 175, 5: 250, 6: 350 };
                const aData = {
                    aqi: aqiMap[epaIndex] || 50,
                    pm2_5: air.pm2_5 || null,
                    pm10: air.pm10 || null
                };

                return { wData, aData };
            };

            const fetchVisualCrossing = async (city) => {
                const visualCrossingKey = (localStorage.getItem('visualcrossing_api_key') || "").trim();
                if (!visualCrossingKey) throw new Error("Visual Crossing key not set");
                const url = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${city.lat},${city.lon}/today?unitGroup=metric&key=${visualCrossingKey}&include=current`;
                const res = await fetch(url);
                if (!res.ok) {
                    throw new Error("Visual Crossing Weather API failed");
                }
                const json = await res.json();
                const current = json.currentConditions || {};
                
                const icon = (current.icon || "").toLowerCase();
                let weathercode = 0;
                if (icon.includes("thunder")) weathercode = 95;
                else if (icon.includes("snow") || icon.includes("sleet")) weathercode = 73;
                else if (icon.includes("rain") || icon.includes("showers")) weathercode = 63;
                else if (icon.includes("fog") || icon.includes("wind")) weathercode = 45;
                else if (icon.includes("cloudy")) weathercode = 2;
                else weathercode = 0;

                const wData = {
                    temp: current.temp !== undefined ? current.temp : null,
                    windspeed: current.windspeed !== undefined ? current.windspeed : null,
                    weathercode: weathercode,
                    rain: current.precip || 0
                };
                return { wData };
            };

            const fetchWAQI = async (city) => {
                const waqiKey = (localStorage.getItem('waqi_api_key') || "").trim();
                if (!waqiKey) {
                    throw new Error("No custom WAQI API key provided (skipping demo token to avoid duplicate Shanghai data)");
                }
                const url = `https://api.waqi.info/feed/geo:${city.lat};${city.lon}/?token=${waqiKey}`;
                const res = await fetch(url);
                if (!res.ok) {
                    throw new Error("WAQI API failed");
                }
                const json = await res.json();
                if (json.status !== "ok" || !json.data) {
                    throw new Error("WAQI API returned invalid status");
                }
                const data = json.data;
                const iaqi = data.iaqi || {};
                return {
                    aqi: data.aqi !== undefined ? data.aqi : null,
                    pm2_5: iaqi.pm25 ? iaqi.pm25.v : null,
                    pm10: iaqi.pm10 ? iaqi.pm10.v : null
                };
            };

            const fetchOpenMeteoSingle = async (city) => {
                const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current=temperature_2m,precipitation,rain,showers,weather_code,wind_speed_10m&timezone=auto`;
                const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${city.lat}&longitude=${city.lon}&current=us_aqi,pm2_5,pm10`;
                
                const [wRes, aRes] = await Promise.all([
                    fetch(weatherUrl),
                    fetch(aqiUrl).catch(() => null)
                ]);
                if (!wRes.ok) {
                    throw new Error("Open-Meteo single fetch failed");
                }
                const wJson = await wRes.json();
                const current = wJson.current || {};
                const wData = {
                    temp: current.temperature_2m !== undefined ? current.temperature_2m : null,
                    windspeed: current.wind_speed_10m !== undefined ? current.wind_speed_10m : null,
                    weathercode: current.weather_code !== undefined ? current.weather_code : 0,
                    rain: current.precipitation || current.rain || 0
                };

                let aData = { aqi: null, pm2_5: null, pm10: null };
                if (aRes && aRes.ok) {
                    try {
                        const aJson = await aRes.json();
                        if (aJson.current) {
                            aData = {
                                aqi: aJson.current.us_aqi || 50,
                                pm2_5: aJson.current.pm2_5 || null,
                                pm10: aJson.current.pm10 || null
                            };
                        }
                    } catch (e) {
                        console.warn("Could not parse Open-Meteo AQI:", e);
                    }
                }
                return { wData, aData };
            };

            const fetchOpenMeteoAqiSingle = async (city) => {
                const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${city.lat}&longitude=${city.lon}&current=us_aqi,pm2_5,pm10`;
                const res = await fetch(aqiUrl);
                if (!res.ok) {
                    throw new Error("Open-Meteo AQI fetch failed");
                }
                const json = await res.json();
                if (json.current) {
                    return {
                        aqi: json.current.us_aqi !== undefined ? json.current.us_aqi : null,
                        pm2_5: json.current.pm2_5 !== undefined ? json.current.pm2_5 : null,
                        pm10: json.current.pm10 !== undefined ? json.current.pm10 : null
                    };
                }
                throw new Error("Invalid Open-Meteo AQI response format");
            };

            // Ingest real-time traffic speeds and travel delays using TomTom flow segment APIs
            const fetchTrafficData = async (currentHubs) => {
                if (!currentHubs || Object.keys(currentHubs).length === 0) return;
                const tomtomApiKey = (localStorage.getItem('tomtom_api_key') || "").trim();
                if (!tomtomApiKey) {
                    console.log("No TomTom API key set. Dashboard will use simulated dynamic highway traffic.");
                    setTomtomTrafficData({});
                    return;
                }
                
                console.log("Fetching live traffic segment data from TomTom...");
                const activeCities = Object.keys(currentHubs);
                const trafficData = {};
                
                const fetchTomTomTraffic = async (cityName, lat, lon) => {
                    try {
                        const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?key=${tomtomApiKey}&point=${lat},${lon}`;
                        const res = await fetch(url);
                        if (res.ok) {
                            const json = await res.json();
                            const flow = json.flowSegmentData || {};
                            const current = flow.currentSpeed || 40;
                            const free = flow.freeFlowSpeed || 45;
                            const currentSecs = flow.currentTravelTime || 60;
                            const freeSecs = flow.freeFlowTravelTime || 50;
                            console.log(`TomTom Traffic segment fetched successfully for ${cityName}: Speed = ${current} km/h (FreeFlow = ${free} km/h)`);
                            return {
                                currentSpeed: current,
                                freeFlowSpeed: free,
                                delayMins: Math.max(0, Math.round((currentSecs - freeSecs) / 60))
                            };
                        } else {
                            console.warn(`TomTom Traffic segment fetch failed for ${cityName} with status ${res.status}: ${res.statusText}`);
                        }
                    } catch (e) {
                        console.error(`TomTom traffic segment fetch failed for ${cityName}:`, e);
                    }
                    return null;
                };

                try {
                    await Promise.all(activeCities.map(async city => {
                        const coords = currentHubs[city];
                        const flow = await fetchTomTomTraffic(city, coords.lat, coords.lon);
                        if (flow) {
                            trafficData[city] = flow;
                        }
                    }));
                    setTomtomTrafficData(trafficData);
                } catch (err) {
                    console.error("TomTom traffic batch fetch failed:", err);
                }
            };

            // Fetch live weather, AQI, and news feed for the hubs in consideration (multi-provider cascade + caching)
            const fetchWeatherDataAndAqiAndNews = async (currentHubs, bypassCache = false, activeWarehouses = warehouses) => {
                if (!currentHubs || Object.keys(currentHubs).length === 0) return;
                const cities = Object.keys(currentHubs);

                let collected = {};
                let collectedAqi = {};
                Object.keys(activeWarehouses).forEach(wKey => {
                    collected[wKey] = { temp: null, windspeed: null, weathercode: null, rain: null };
                    collectedAqi[wKey] = { aqi: null, pm2_5: null, pm10: null };
                });
                cities.forEach(city => {
                    collected[city] = { temp: null, windspeed: null, weathercode: null, rain: null };
                    collectedAqi[city] = { aqi: null, pm2_5: null, pm10: null };
                });

                // Immediately update to null states (or cached states if available) to avoid stale values
                setWeatherData(collected);
                setAqiData(collectedAqi);

                const allCitiesToFetch = [
                    ...Object.values(activeWarehouses).map(w => ({ name: w.name, lat: w.lat, lon: w.lon })),
                    ...cities.map(city => ({ name: city, lat: currentHubs[city].lat, lon: currentHubs[city].lon }))
                ];

                const remainingCities = ["asansol", "bhagalpur", "dhanbad", "durgapur", "darbhanga", "hazaribagh", "kharagpur", "shillong", "puri", "cuttack"];

                const uniqueSourcesUsed = new Set();

                // Process each city checking caching first
                for (const city of allCitiesToFetch) {
                    const cached = bypassCache ? null : getCachedWeather(city.name);
                    if (cached) {
                        collected[city.name] = cached.weather;
                        collectedAqi[city.name] = cached.aqi;
                        console.log(`Cache hit: weather/AQI for ${city.name} loaded from cache (Source: ${cached.source})`);
                        const wSource = cached.source.split(" / ")[0];
                        uniqueSourcesUsed.add(wSource);
                        continue;
                    }

                    // Cache missed/expired. Cascade check:
                    let weatherFetched = null;
                    let weatherAqiFallback = null;
                    let weatherSource = "";

                    const cleanName = city.name.split(",")[0].trim().toLowerCase();
                    const isRemainingCity = remainingCities.includes(cleanName);

                    // Build cascade list depending on if it's a remaining city
                    let weatherProviders = [];
                    if (isRemainingCity) {
                        weatherProviders = [
                            { name: "Visual Crossing", fn: fetchVisualCrossing },
                            { name: "OpenWeatherMap", fn: fetchOWM },
                            { name: "WeatherAPI", fn: fetchWeatherAPI },
                            { name: "Open-Meteo", fn: fetchOpenMeteoSingle }
                        ];
                    } else {
                        weatherProviders = [
                            { name: "OpenWeatherMap", fn: fetchOWM },
                            { name: "WeatherAPI", fn: fetchWeatherAPI },
                            { name: "Visual Crossing", fn: fetchVisualCrossing },
                            { name: "Open-Meteo", fn: fetchOpenMeteoSingle }
                        ];
                    }

                    // Weather Cascade loop
                    for (const provider of weatherProviders) {
                        try {
                            const res = await provider.fn(city);
                            if (res && res.wData && res.wData.temp !== null) {
                                weatherFetched = res.wData;
                                weatherAqiFallback = res.aData || null;
                                weatherSource = provider.name;
                                break;
                            }
                        } catch (err) {
                            console.warn(`Weather provider ${provider.name} failed for ${city.name}:`, err);
                        }
                    }

                    // AQI Cascade loop
                    let aqiFetched = null;
                    let aqiSource = "";

                    // 1. Try WAQI first
                    try {
                        const waqiRes = await fetchWAQI(city);
                        if (waqiRes && waqiRes.aqi !== null) {
                            aqiFetched = waqiRes;
                            aqiSource = "WAQI";
                        }
                    } catch (err) {
                        console.warn(`WAQI fetch failed for ${city.name}:`, err);
                    }

                    // 2. Fallback to Open-Meteo AQI (prioritize dedicated keyless granular AQI)
                    if (!aqiFetched) {
                        try {
                            const meteoRes = await fetchOpenMeteoAqiSingle(city);
                            if (meteoRes && meteoRes.aqi !== null) {
                                aqiFetched = meteoRes;
                                aqiSource = "Open-Meteo";
                            }
                        } catch (err) {
                            console.error(`Open-Meteo AQI fallback failed for ${city.name}:`, err);
                        }
                    }

                    // 3. Fallback to weather API's AQI (OWM/WeatherAPI)
                    if (!aqiFetched && weatherAqiFallback && weatherAqiFallback.aqi !== null) {
                        aqiFetched = weatherAqiFallback;
                        aqiSource = weatherSource;
                    }

                    // Ensure we have some default if all failed
                    if (!weatherFetched) {
                        weatherFetched = { temp: 28, windspeed: 12, weathercode: 0, rain: 0 };
                        weatherSource = "Open-Meteo Fallback";
                    }
                    if (!aqiFetched) {
                        aqiFetched = { aqi: 75, pm2_5: 22, pm10: 45 };
                        aqiSource = "Open-Meteo Fallback";
                    }

                    collected[city.name] = weatherFetched;
                    collectedAqi[city.name] = aqiFetched;
                    
                    const cacheSourceStr = `${weatherSource} / AQI: ${aqiSource}`;
                    saveWeatherToCache(city.name, weatherFetched, aqiFetched, cacheSourceStr);
                    console.log(`Successfully fetched and cached ${city.name} (Weather: ${weatherSource}, AQI: ${aqiSource})`);
                    uniqueSourcesUsed.add(weatherSource);
                }

                // Update active weather source indicator
                let sourceStr = "Open-Meteo Fallback";
                if (uniqueSourcesUsed.size === 1) {
                    sourceStr = Array.from(uniqueSourcesUsed)[0];
                } else if (uniqueSourcesUsed.size > 1) {
                    sourceStr = "Hybrid (" + Array.from(uniqueSourcesUsed).join(", ") + ")";
                }
                setWeatherSourceString(sourceStr);
                setIsOwmFallback(sourceStr.includes("Meteo") || sourceStr.includes("Hybrid"));

                const firstWName = Object.keys(activeWarehouses)[0] || "Patna HQ DC";
                if (collected[firstWName] && collected[firstWName].temp !== null) {
                    setHqWeather(`${collected[firstWName].temp}°C`);
                } else if (collected["Patna, BR"] && collected["Patna, BR"].temp !== null) {
                    setHqWeather(`${collected["Patna, BR"].temp}°C`);
                }

                setWeatherData({ ...collected });
                setAqiData({ ...collectedAqi });

                // Fetch live news alerts
                await fetchLiveNewsAlerts(currentHubs, collected, collectedAqi);
            };

            // Dynamic Data & Weather/Traffic Refresh Action
            const triggerDataRefresh = async (bypassCache = false) => {
                console.log(`Triggering dynamic logs refresh (bypassCache: ${bypassCache})...`);
                try {
                    // Bypass cache using cachebuster
                    const res = await fetch("orders.csv?t=" + Date.now());
                    if (!res.ok) throw new Error("CSV reload failed");
                    const text = await res.text();
                    const wb = XLSX.read(text, { type: "string" });
                    
                    const sheet = wb.Sheets[wb.SheetNames[0]];
                    const rawData = XLSX.utils.sheet_to_json(sheet);
                    
                    setRawOrders(processAndShiftOrders(rawData));
                } catch (err) {
                    console.error("Excel reload failed:", err);
                }

                // Refresh Live Traffic Segment details
                if (Object.keys(hubsCoords).length > 0) {
                    await fetchTrafficData(hubsCoords);
                }

                // Refresh Weather, AQI, and News
                if (Object.keys(hubsCoords).length > 0) {
                    await fetchWeatherDataAndAqiAndNews(hubsCoords, bypassCache);
                }

                const nowStr = getFormattedDateTime();
                setLastOrdersFetch(nowStr);
                setLastTrafficFetch(nowStr);
                setLastWeatherFetch(nowStr);
                setLastAqiFetch(nowStr);
                setLastNewsFetch(nowStr);
                setLastFetchTime(nowStr);
            };

            const handleManualRefresh = async () => {
                if (isRefreshing) return;
                setIsRefreshing(true);
                setLoadingStage("Manually fetching fresh data for all APIs...");
                try {
                    await triggerDataRefresh(true);
                    setRefreshTimer(600); // Reset timer to 600s
                } catch (e) {
                    console.error("Manual refresh failed:", e);
                } finally {
                    setIsRefreshing(false);
                }
            };

            // Individual API Sync Handlers
            const refreshOrdersOnly = async () => {
                if (isRefreshing || refreshingOrders) return;
                setRefreshingOrders(true);
                try {
                    const res = await fetch("orders.csv?t=" + Date.now());
                    if (!res.ok) throw new Error("CSV reload failed");
                    const text = await res.text();
                    const wb = XLSX.read(text, { type: "string" });
                    
                    const sheet = wb.Sheets[wb.SheetNames[0]];
                    let rawData = XLSX.utils.sheet_to_json(sheet);

                    // Merge local orders from localStorage
                    const localOrdersStr = localStorage.getItem("scm_local_orders");
                    if (localOrdersStr) {
                        try {
                            const localOrders = JSON.parse(localOrdersStr);
                            rawData = rawData.concat(localOrders);
                        } catch (e) {
                            console.error("Failed to parse local orders", e);
                        }
                    }
                    
                    setRawOrders(processAndShiftOrders(rawData));
                    const nowStr = getFormattedDateTime();
                    setLastOrdersFetch(nowStr);
                    setLastFetchTime(nowStr);
                } catch (e) {
                    console.error("Orders refresh failed:", e);
                } finally {
                    setRefreshingOrders(false);
                }
            };

            const refreshTrafficOnly = async () => {
                if (isRefreshing || refreshingTraffic) return;
                setRefreshingTraffic(true);
                try {
                    if (Object.keys(hubsCoords).length > 0) {
                        await fetchTrafficData(hubsCoords);
                    }
                    const nowStr = getFormattedDateTime();
                    setLastTrafficFetch(nowStr);
                    setLastFetchTime(nowStr);
                } catch (e) {
                    console.error("Traffic refresh failed:", e);
                } finally {
                    setRefreshingTraffic(false);
                }
            };

            const refreshWeatherOnly = async () => {
                if (isRefreshing || refreshingWeather) return;
                setRefreshingWeather(true);
                try {
                    const cities = Object.keys(hubsCoords);
                    const allCitiesToFetch = [
                        ...Object.values(warehouses).map(w => ({ name: w.name, lat: w.lat, lon: w.lon })),
                        ...cities.map(city => ({ name: city, lat: hubsCoords[city].lat, lon: hubsCoords[city].lon }))
                    ];

                    const remainingCities = ["asansol", "bhagalpur", "dhanbad", "durgapur", "darbhanga", "hazaribagh", "kharagpur", "shillong", "puri", "cuttack"];
                    let collected = { ...weatherData };
                    const uniqueSourcesUsed = new Set();

                    for (const city of allCitiesToFetch) {
                        let weatherFetched = null;
                        let weatherSource = "";

                        const cleanName = city.name.split(",")[0].trim().toLowerCase();
                        const isRemainingCity = remainingCities.includes(cleanName);

                        let weatherProviders = [];
                        if (isRemainingCity) {
                            weatherProviders = [
                                { name: "Visual Crossing", fn: fetchVisualCrossing },
                                { name: "OpenWeatherMap", fn: fetchOWM },
                                { name: "WeatherAPI", fn: fetchWeatherAPI },
                                { name: "Open-Meteo", fn: fetchOpenMeteoSingle }
                            ];
                        } else {
                            weatherProviders = [
                                { name: "OpenWeatherMap", fn: fetchOWM },
                                { name: "WeatherAPI", fn: fetchWeatherAPI },
                                { name: "Visual Crossing", fn: fetchVisualCrossing },
                                { name: "Open-Meteo", fn: fetchOpenMeteoSingle }
                            ];
                        }

                        for (const provider of weatherProviders) {
                            try {
                                const res = await provider.fn(city);
                                if (res && res.wData && res.wData.temp !== null) {
                                    weatherFetched = res.wData;
                                    weatherSource = provider.name;
                                    break;
                                }
                            } catch (err) {
                                // ignore
                            }
                        }

                        if (!weatherFetched) {
                            weatherFetched = { temp: 28, windspeed: 12, weathercode: 0, rain: 0 };
                            weatherSource = "Cascade Fallback";
                        }

                        collected[city.name] = weatherFetched;
                        
                        const cachedEntry = getCachedWeather(city.name) || {};
                        const currentAqi = cachedEntry.aqi || { aqi: 75, pm2_5: 22, pm10: 45 };
                        const currentAqiSource = cachedEntry.source ? (cachedEntry.source.split(" / AQI: ")[1] || "Cascade Fallback") : "Cascade Fallback";
                        saveWeatherToCache(city.name, weatherFetched, currentAqi, `${weatherSource} / AQI: ${currentAqiSource}`);
                        uniqueSourcesUsed.add(weatherSource);
                    }

                    let sourceStr = "Weather Feed (Cascade)";
                    if (uniqueSourcesUsed.size === 1) {
                        sourceStr = Array.from(uniqueSourcesUsed)[0];
                    } else if (uniqueSourcesUsed.size > 1) {
                        sourceStr = "Hybrid (" + Array.from(uniqueSourcesUsed).join(", ") + ")";
                    }
                    setWeatherSourceString(sourceStr);
                    setIsOwmFallback(sourceStr.includes("Meteo") || sourceStr.includes("Hybrid"));

                    const firstWName = Object.keys(warehouses)[0] || "Patna HQ DC";
                    if (collected[firstWName] && collected[firstWName].temp !== null) {
                        setHqWeather(`${collected[firstWName].temp}°C`);
                    } else if (collected["Patna, BR"] && collected["Patna, BR"].temp !== null) {
                        setHqWeather(`${collected["Patna, BR"].temp}°C`);
                    }

                    setWeatherData({ ...collected });
                    const nowStr = getFormattedDateTime();
                    setLastWeatherFetch(nowStr);
                    setLastFetchTime(nowStr);
                } catch (e) {
                    console.error("Weather refresh failed:", e);
                } finally {
                    setRefreshingWeather(false);
                }
            };

            const refreshAqiOnly = async () => {
                if (isRefreshing || refreshingAqi) return;
                setRefreshingAqi(true);
                try {
                    const cities = Object.keys(hubsCoords);
                    const allCitiesToFetch = [
                        ...Object.values(warehouses).map(w => ({ name: w.name, lat: w.lat, lon: w.lon })),
                        ...cities.map(city => ({ name: city, lat: hubsCoords[city].lat, lon: hubsCoords[city].lon }))
                    ];

                    let collectedAqi = { ...aqiData };

                    for (const city of allCitiesToFetch) {
                        let aqiFetched = null;
                        let aqiSource = "";

                        try {
                            const waqiRes = await fetchWAQI(city);
                            if (waqiRes && waqiRes.aqi !== null) {
                                aqiFetched = waqiRes;
                                aqiSource = "WAQI";
                            }
                        } catch (err) {
                            // ignore
                        }

                        if (!aqiFetched) {
                            try {
                                const meteoRes = await fetchOpenMeteoAqiSingle(city);
                                if (meteoRes && meteoRes.aqi !== null) {
                                    aqiFetched = meteoRes;
                                    aqiSource = "Open-Meteo";
                                }
                            } catch (err) {
                                // ignore
                            }
                        }

                        if (!aqiFetched) {
                            try {
                                const res = await fetchOWM(city);
                                if (res && res.aData && res.aData.aqi !== null) {
                                    aqiFetched = res.aData;
                                    aqiSource = "OpenWeatherMap";
                                }
                            } catch (err) {
                                // ignore
                            }
                        }

                        if (!aqiFetched) {
                            aqiFetched = { aqi: 75, pm2_5: 22, pm10: 45 };
                            aqiSource = "Cascade Fallback";
                        }

                        collectedAqi[city.name] = aqiFetched;

                        const cachedEntry = getCachedWeather(city.name) || {};
                        const currentWeather = cachedEntry.weather || { temp: 28, windspeed: 12, weathercode: 0, rain: 0 };
                        const currentWeatherSource = cachedEntry.source ? (cachedEntry.source.split(" / ")[0] || "Cascade Fallback") : "Cascade Fallback";
                        saveWeatherToCache(city.name, currentWeather, aqiFetched, `${currentWeatherSource} / AQI: ${aqiSource}`);
                    }

                    setAqiData({ ...collectedAqi });
                    const nowStr = getFormattedDateTime();
                    setLastAqiFetch(nowStr);
                    setLastFetchTime(nowStr);
                } catch (e) {
                    console.error("AQI refresh failed:", e);
                } finally {
                    setRefreshingAqi(false);
                }
            };

            const refreshNewsOnly = async () => {
                if (isRefreshing || refreshingNews) return;
                setRefreshingNews(true);
                try {
                    await fetchLiveNewsAlerts(hubsCoords, weatherData, aqiData);
                    const nowStr = getFormattedDateTime();
                    setLastNewsFetch(nowStr);
                    setLastFetchTime(nowStr);
                } catch (e) {
                    console.error("News refresh failed:", e);
                } finally {
                    setRefreshingNews(false);
                }
            };

            // Recalculation delay helpers
            const calculateLiveDelays = (hubName, orderId, lat, lon) => {
                const weather = computeWeatherEffects(hubName, lat, lon);
                const weatherDelay = weather.delay || 0;
                const weatherDescription = weather.description || "Clear";

                const aqiInfo = computeAqiEffects(hubName);
                const aqiDelay = aqiInfo.delay || 0;
                const aqiDescription = aqiInfo.description || "Healthy Air";

                let trafficDelay = 0;
                let trafficReason = "Optimal Traffic Flow";
                
                const liveTraffic = tomtomTrafficData[hubName];
                if (liveTraffic) {
                    trafficDelay = liveTraffic.delayMins;
                    if (trafficDelay > 30) {
                        trafficReason = `Severe Congestion (TomTom: ${liveTraffic.currentSpeed}/${liveTraffic.freeFlowSpeed} km/h, +${trafficDelay}m)`;
                    } else if (trafficDelay > 15) {
                        trafficReason = `Moderate Congestion (TomTom: ${liveTraffic.currentSpeed}/${liveTraffic.freeFlowSpeed} km/h, +${trafficDelay}m)`;
                    } else if (trafficDelay > 5) {
                        trafficReason = `Slow Traffic (TomTom: ${liveTraffic.currentSpeed}/${liveTraffic.freeFlowSpeed} km/h, +${trafficDelay}m)`;
                    } else {
                        trafficReason = `Free Flow Traffic (TomTom: ${liveTraffic.currentSpeed} km/h)`;
                    }
                } else {
                    const timeIndex = Math.floor(Date.now() / (600 * 1000));
                    let hash = timeIndex;
                    for (let i = 0; i < hubName.length; i++) hash += hubName.charCodeAt(i);
                    for (let i = 0; i < orderId.length; i++) hash += orderId.charCodeAt(i);
                    
                    const severity = hash % 10;
                    if (severity === 9) {
                        trafficDelay = 45 + (hash % 15);
                        trafficReason = `NH Highway Blockage / Major Accident (+${trafficDelay}m)`;
                    } else if (severity >= 7) {
                        trafficDelay = 20 + (hash % 15);
                        trafficReason = `Heavy Construction / Highway Lane Closure (+${trafficDelay}m)`;
                    } else if (severity >= 4) {
                        trafficDelay = 8 + (hash % 10);
                        trafficReason = `Peak Highway Traffic Congestion (+${trafficDelay}m)`;
                    } else {
                        trafficDelay = 2 + (hash % 4);
                        trafficReason = `Optimal Highway Speed (Free Flow)`;
                    }
                }

                let newsDelay = 0;
                let newsReason = "";
                let newsInfo = null;
                const matchingNews = newsAlerts.filter(n => n.hub === hubName);
                if (matchingNews.length > 0) {
                    const maxNewsAlert = matchingNews.reduce((max, cur) => cur.delay > max.delay ? cur : max, matchingNews[0]);
                    newsDelay = maxNewsAlert.delay;
                    newsReason = `[News] ${maxNewsAlert.title} (+${newsDelay}m)`;
                    newsInfo = maxNewsAlert;
                }

                const totalDelay = weatherDelay + trafficDelay + newsDelay + aqiDelay;
                const reasons = [];
                if (weatherDelay > 0) reasons.push(weatherDescription);
                if (trafficDelay > 0) reasons.push(trafficReason);
                if (newsDelay > 0) reasons.push(newsReason);
                if (aqiDelay > 0) reasons.push(aqiDescription);
                const reason = reasons.length > 0 ? reasons.join(" & ") : "Clear & Optimal";

                return {
                    weatherDelay,
                    weatherDescription,
                    weatherInfo: weather,
                    aqiDelay,
                    aqiDescription,
                    aqiInfo,
                    trafficDelay,
                    trafficReason,
                    newsDelay,
                    newsReason,
                    newsInfo,
                    totalDelay,
                    reason
                };
            };

            const handleAddWarehouse = async (name, lat, lon, originalName) => {
                const newWarehouses = { ...warehouses };
                if (originalName && originalName !== name) {
                    delete newWarehouses[originalName];
                }
                newWarehouses[name] = { name, lat: parseFloat(lat), lon: parseFloat(lon) };
                
                let success = false;
                try {
                    const res = await fetch("/api/locations/warehouse", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ name, lat: parseFloat(lat), lon: parseFloat(lon), originalName })
                    });
                    if (res.ok) {
                        const data = await res.json();
                        if (data.warehouses) {
                            setWarehouses(data.warehouses);
                            localStorage.setItem("scm_warehouses", JSON.stringify(data.warehouses));
                            success = true;
                        }
                    }
                } catch (err) {
                    console.error("API failed, using localStorage fallback for warehouse registration:", err);
                }

                if (!success) {
                    setWarehouses(newWarehouses);
                    localStorage.setItem("scm_warehouses", JSON.stringify(newWarehouses));
                }

                // Rename references in orders:
                if (originalName && originalName !== name) {
                    setRawOrders(prevOrders => {
                        const updated = prevOrders.map(o => {
                            if (o.SourceWarehouse === originalName) {
                                return { ...o, SourceWarehouse: name };
                            }
                            return o;
                        });
                        localStorage.setItem("scm_local_orders", JSON.stringify(updated.filter(o => o.isLocal)));
                        return updated;
                    });
                }

                // Fetch weather for new warehouses list
                await fetchWeatherDataAndAqiAndNews(hubsCoords, false, newWarehouses);
            };

            const handleAddCity = async (city, lat, lon, originalCity) => {
                const newHubsCoords = { ...hubsCoords };
                if (originalCity && originalCity !== city) {
                    delete newHubsCoords[originalCity];
                }
                newHubsCoords[city] = { lat: parseFloat(lat), lon: parseFloat(lon) };
                
                let success = false;
                try {
                    const res = await fetch("/api/locations/city", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ city, lat: parseFloat(lat), lon: parseFloat(lon), originalCity })
                    });
                    if (res.ok) {
                        success = true;
                    }
                } catch (err) {
                    console.error("API failed, using localStorage fallback for delivery city registration:", err);
                }

                const localHubsStr = localStorage.getItem("scm_local_hubs") || "{}";
                const localHubs = JSON.parse(localHubsStr);
                if (originalCity && originalCity !== city) {
                    delete localHubs[originalCity];
                }
                localHubs[city] = { lat: parseFloat(lat), lon: parseFloat(lon) };
                localStorage.setItem("scm_local_hubs", JSON.stringify(localHubs));
                
                setHubsCoords(newHubsCoords);

                // Rename references in orders:
                if (originalCity && originalCity !== city) {
                    setRawOrders(prevOrders => {
                        const updated = prevOrders.map(o => {
                            if (o.RouteHub === originalCity) {
                                return { ...o, RouteHub: city, Latitude: parseFloat(lat), Longitude: parseFloat(lon) };
                            }
                            return o;
                        });
                        localStorage.setItem("scm_local_orders", JSON.stringify(updated.filter(o => o.isLocal)));
                        return updated;
                    });
                }

                // Synchronously fetch traffic and weather for the new city
                await fetchTrafficData(newHubsCoords);
                await fetchWeatherDataAndAqiAndNews(newHubsCoords, true, warehouses);
            };

            const handleAddOrder = async (order) => {
                let success = false;
                try {
                    const res = await fetch("/api/orders", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(order)
                    });
                    if (res.ok) {
                        success = true;
                    }
                } catch (err) {
                    console.error("API failed, using localStorage fallback for order registration:", err);
                }

                // Save to localStorage
                const localOrdersStr = localStorage.getItem("scm_local_orders") || "[]";
                const localOrders = JSON.parse(localOrdersStr);
                localOrders.push(order);
                localStorage.setItem("scm_local_orders", JSON.stringify(localOrders));

                // Update rawOrders state locally
                setRawOrders(prevOrders => {
                    const updated = [...prevOrders, order];
                    return processAndShiftOrders(updated);
                });
            };

            // Countdown Timer for Auto Refresh
            useEffect(() => {
                const countdown = setInterval(() => {
                    setRefreshTimer(prev => {
                        if (prev <= 1) {
                            triggerDataRefresh();
                            return 600;
                        }
                        return prev - 1;
                    });
                }, 1000);
                return () => clearInterval(countdown);
            }, [hubsCoords]);

            // Helper to get simulated or live HQ weather
            const getActiveHqWeather = () => {
                if (weatherScenario === "live") {
                    const apiKey = localStorage.getItem('openweathermap_api_key') || "000bd6759eb2260d3900697d8faf36fd";
                    if (!apiKey) return "Setup Key";
                    return hqWeather;
                }
                const effects = computeWeatherEffects("Patna, BR", centralWarehouse.lat, centralWarehouse.lon);
                return effects.temp !== null ? `${Math.round(effects.temp)}°C` : "Loading...";
            };

            // Robust normalization of date values parsed from Excel
            const normalizeExcelDate = (val) => {
                if (!val) return "";
                if (val instanceof Date) {
                    // Use UTC methods to prevent timezone shifting (since Excel dates are timezone-agnostic)
                    const yyyy = val.getUTCFullYear();
                    const mm = String(val.getUTCMonth() + 1).padStart(2, '0');
                    const dd = String(val.getUTCDate()).padStart(2, '0');
                    return `${yyyy}-${mm}-${dd}`;
                }
                const str = String(val).trim();
                // Check if it's an Excel serial date number
                const num = Number(str);
                if (!isNaN(num) && num > 30000 && num < 60000) {
                    const utc_days = Math.floor(num - 25569);
                    const date_info = new Date(utc_days * 86400 * 1000);
                    const yyyy = date_info.getUTCFullYear();
                    const mm = String(date_info.getUTCMonth() + 1).padStart(2, '0');
                    const dd = String(date_info.getUTCDate()).padStart(2, '0');
                    return `${yyyy}-${mm}-${dd}`;
                }
                if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
                    return str;
                }
                // Match MM/DD/YY or MM/DD/YYYY
                if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(str)) {
                    const parts = str.split('/');
                    let month = parts[0].padStart(2, '0');
                    let day = parts[1].padStart(2, '0');
                    let year = parts[2];
                    if (year.length === 2) {
                        year = "20" + year;
                    }
                    return `${year}-${month}-${day}`;
                }
                const d = new Date(str);
                if (!isNaN(d.getTime())) {
                    const yyyy = d.getFullYear();
                    const mm = String(d.getMonth() + 1).padStart(2, '0');
                    const dd = String(d.getDate()).padStart(2, '0');
                    return `${yyyy}-${mm}-${dd}`;
                }
                return str;
            };

            // Shift Excel dates dynamically to keep active orders matching today's actual date
            const processAndShiftOrders = (rawData) => {
                if (!rawData || rawData.length === 0) return [];
                
                // 1. Normalize dates
                const normalized = rawData.map(o => ({
                    ...o,
                    OrderDate: normalizeExcelDate(o.OrderDate)
                }));

                // 2. Find the max date in the dataset
                let maxDateStr = "";
                normalized.forEach(o => {
                    if (o.OrderDate && o.OrderDate > maxDateStr) {
                        maxDateStr = o.OrderDate;
                    }
                });

                if (!maxDateStr) return normalized;

                // 3. Get current local date in standard YYYY-MM-DD format
                const today = new Date();
                const yyyy = today.getFullYear();
                const mm = String(today.getMonth() + 1).padStart(2, '0');
                const dd = String(today.getDate()).padStart(2, '0');
                const todayStr = `${yyyy}-${mm}-${dd}`;

                if (maxDateStr !== todayStr) {
                    const maxDateObj = new Date(maxDateStr + "T12:00:00");
                    const todayObj = new Date(todayStr + "T12:00:00");
                    const diffTime = todayObj.getTime() - maxDateObj.getTime();
                    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

                    if (diffDays !== 0) {
                        console.log(`Dynamic Date Sync: Excel Max Date is ${maxDateStr}. Local Today is ${todayStr}. Shifting all dates by ${diffDays} days.`);
                        return normalized.map(o => {
                            if (!o.OrderDate) return o;
                            const d = new Date(o.OrderDate + "T12:00:00");
                            d.setDate(d.getDate() + diffDays);
                            const y = d.getFullYear();
                            const m = String(d.getMonth() + 1).padStart(2, '0');
                            const day = String(d.getDate()).padStart(2, '0');
                            return {
                                ...o,
                                OrderDate: `${y}-${m}-${day}`
                            };
                        });
                    }
                }
                return normalized;
            };

            // Ingest and Process CSV Hubs and Excel Order Data
            useEffect(() => {
                const loadAllData = async () => {
                    try {
                        // Load API keys from server first
                        try {
                            const keysRes = await fetch("/api/keys");
                            if (keysRes.ok) {
                                const keys = await keysRes.json();
                                if (keys.openweathermap) setApiKeyInput(keys.openweathermap);
                                if (keys.weatherapi) setWeatherApiKeyInput(keys.weatherapi);
                                if (keys.tomtom) setTomtomApiKeyInput(keys.tomtom);
                                if (keys.visualcrossing) setVisualCrossingApiKeyInput(keys.visualcrossing);
                                if (keys.waqi) setWaqiApiKeyInput(keys.waqi);
                            }
                        } catch (err) {
                            console.error("Failed to fetch API keys from server:", err);
                        }

                        // Load warehouses first
                        let loadedWarehouses = { "Patna HQ DC": { name: "Patna HQ DC", lat: 25.5941, lon: 85.1376 } };
                        try {
                            const wRes = await fetch("/api/warehouses");
                            if (wRes.ok) {
                                loadedWarehouses = await wRes.json();
                                setWarehouses(loadedWarehouses);
                            } else {
                                throw new Error();
                            }
                        } catch (e) {
                            console.log("Could not fetch warehouses from API, trying localStorage");
                            const localW = localStorage.getItem("scm_warehouses");
                            if (localW) {
                                try {
                                    loadedWarehouses = JSON.parse(localW);
                                    setWarehouses(loadedWarehouses);
                                } catch (err) {}
                            }
                        }

                        // 1. Fetch and parse hubs.csv
                        const hubsRes = await fetch("hubs.csv");
                        if (!hubsRes.ok) throw new Error("Could not fetch hubs.csv");
                        const hubsText = await hubsRes.text();
                        const hubsWb = XLSX.read(hubsText, { type: "string" });
                        const hubsSheet = hubsWb.Sheets[hubsWb.SheetNames[0]];
                        const hubsList = XLSX.utils.sheet_to_json(hubsSheet);
                        
                        const hubs = {};
                        hubsList.forEach(h => {
                            hubs[h.City] = {
                                lat: parseFloat(h.Latitude),
                                lon: parseFloat(h.Longitude)
                            };
                        });

                        // Merge local hubs from localStorage
                        const localHubsStr = localStorage.getItem("scm_local_hubs");
                        if (localHubsStr) {
                            try {
                                const localHubs = JSON.parse(localHubsStr);
                                Object.assign(hubs, localHubs);
                            } catch (e) {
                                console.error("Failed to parse local hubs", e);
                            }
                        }
                        setHubsCoords(hubs);

                        // 2. Fetch live Traffic and Weather synchronously before loading completes
                        setLoadingStage("Fetching live route traffic details...");
                        await fetchTrafficData(hubs);

                        setLoadingStage("Fetching live weather and air quality telemetry...");
                        await fetchWeatherDataAndAqiAndNews(hubs);

                        // 3. Fetch historical weather archive data for the last 14 days
                        const cities = Object.keys(hubs);
                        const lats = [centralWarehouse.lat, ...cities.map(c => hubs[c].lat)].join(",");
                        const lons = [centralWarehouse.lon, ...cities.map(c => hubs[c].lon)].join(",");
                        
                        const today = new Date();
                        const getNDaysAgoStrLocal = (n) => {
                            const d = new Date();
                            d.setDate(today.getDate() - n);
                            const y = d.getFullYear();
                            const m = String(d.getMonth() + 1).padStart(2, '0');
                            const day = String(d.getDate()).padStart(2, '0');
                            return `${y}-${m}-${day}`;
                        };
                        const startDate = getNDaysAgoStrLocal(13);
                        const endDate = getNDaysAgoStrLocal(0);

                        try {
                            const histRes = await fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${lats}&longitude=${lons}&start_date=${startDate}&end_date=${endDate}&daily=temperature_2m_max,windspeed_10m_max,rain_sum&timezone=auto`);
                            if (histRes.ok) {
                                const histJson = await histRes.json();
                                const results = Array.isArray(histJson) ? histJson : [histJson];
                                
                                const collectedHistory = {};
                                cities.forEach((city, idx) => {
                                    const result = results[idx + 1]; // index 0 is Patna HQ
                                    if (result && result.daily) {
                                        collectedHistory[city] = {
                                            dates: result.daily.time,
                                            temp: result.daily.temperature_2m_max,
                                            windspeed: result.daily.windspeed_10m_max,
                                            rain: result.daily.rain_sum
                                        };
                                    }
                                });
                                // Patna HQ DC itself
                                if (results[0] && results[0].daily) {
                                    collectedHistory["Patna, BR"] = {
                                        dates: results[0].daily.time,
                                        temp: results[0].daily.temperature_2m_max,
                                        windspeed: results[0].daily.windspeed_10m_max,
                                        rain: results[0].daily.rain_sum
                                    };
                                }
                                setHistoricalWeatherData(collectedHistory);
                            }
                        } catch (histErr) {
                            console.error("Failed to fetch historical weather archive:", histErr);
                        }

                        // 4. Fetch and parse orders.csv with cache buster
                        const res = await fetch("orders.csv?t=" + Date.now());
                        if (!res.ok) throw new Error("Could not fetch orders.csv");
                        const text = await res.text();
                        const wb = XLSX.read(text, { type: "string" });
                        
                        const sheet = wb.Sheets[wb.SheetNames[0]];
                        let rawData = XLSX.utils.sheet_to_json(sheet);

                        // Merge local orders from localStorage
                        const localOrdersStr = localStorage.getItem("scm_local_orders");
                        if (localOrdersStr) {
                            try {
                                const localOrders = JSON.parse(localOrdersStr);
                                rawData = rawData.concat(localOrders);
                            } catch (e) {
                                console.error("Failed to parse local orders", e);
                            }
                        }
                        
                        setRawOrders(processAndShiftOrders(rawData));
                        const nowStr = getFormattedDateTime();
                        setLastOrdersFetch(nowStr);
                        setLastTrafficFetch(nowStr);
                        setLastWeatherFetch(nowStr);
                        setLastAqiFetch(nowStr);
                        setLastNewsFetch(nowStr);
                        setLastFetchTime(nowStr);
                        setLoading(false);
                    } catch (e) {
                        console.error(e);
                        setLoading(false);
                    }
                };
                loadAllData();
            }, []);


            // Helper function to shift ETA by adding minutes
            const addMinutesToETA = (etaStr, mins) => {
                try {
                    const parts = etaStr.match(/([A-Za-z]+)\s+(\d+),\s+(\d+):(\d+)\s+([APap][Mm])/);
                    if (!parts) return etaStr;
                    const [_, monthName, dayStr, hourStr, minStr, ampm] = parts;
                    const months = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
                    const month = months[monthName.slice(0, 3)] || 4;
                    const day = parseInt(dayStr, 10);
                    let hour = parseInt(hourStr, 10);
                    if (ampm.toLowerCase() === "pm" && hour < 12) hour += 12;
                    if (ampm.toLowerCase() === "am" && hour === 12) hour = 0;
                    const min = parseInt(minStr, 10);
                    
                    const currentYear = new Date().getFullYear();
                    const date = new Date(currentYear, month, day, hour, min);
                    date.setMinutes(date.getMinutes() + mins);
                    
                    const resMonth = date.toLocaleString('en-US', { month: 'short' });
                    const resDay = date.getDate();
                    let resHour = date.getHours();
                    const resMin = String(date.getMinutes()).padStart(2, '0');
                    const resAmpm = resHour >= 12 ? 'PM' : 'AM';
                    resHour = resHour % 12;
                    if (resHour === 0) resHour = 12;
                    
                    return `${resMonth} ${resDay}, ${String(resHour).padStart(2, '0')}:${resMin} ${resAmpm}`;
                } catch (e) {
                    return etaStr;
                }
            };


            // Main Weather Effect Calculator
            const computeWeatherEffects = (hubName, lat, lon) => {
                let temp = null;
                let windspeed = null;
                let weathercode = null;
                let rain = null;

                if (weatherScenario === "live") {
                    const live = weatherData[hubName];
                    if (live) {
                        temp = live.temp;
                        windspeed = live.windspeed;
                        weathercode = live.weathercode;
                        rain = live.rain || 0;
                    }
                } else {
                    let baseTemp = 24;
                    let baseWind = 10;
                    let baseCode = 0;
                    let baseRain = 0;

                    if (weatherScenario === "heatwave") {
                        const hash = (Math.abs(lat) * 100 + Math.abs(lon) * 10) % 5;
                        baseTemp = 42.5 + hash;
                        baseWind = 8 + (hash % 3) * 2;
                        baseCode = 0;
                        baseRain = 0;
                    } else if (weatherScenario === "gale") {
                        const hash = (Math.abs(lat) * 100 + Math.abs(lon) * 10) % 5;
                        baseTemp = 26.5 + (hash % 3);
                        baseWind = 52.0 + hash * 3;
                        baseCode = 1;
                        baseRain = 0;
                    } else if (weatherScenario === "storm") {
                        const hash = (Math.abs(lat) * 100 + Math.abs(lon) * 10) % 5;
                        baseTemp = 20.5 + (hash % 2);
                        baseWind = 72.0 + hash * 4;
                        baseCode = 65;
                        baseRain = 0;
                    } else if (weatherScenario === "rain") {
                        const hash = (Math.abs(lat) * 100 + Math.abs(lon) * 10) % 5;
                        baseTemp = 23.5 + (hash % 3);
                        baseWind = 18.0 + hash * 2;
                        baseCode = 63;
                        baseRain = 12.5;
                    } else if (weatherScenario === "drizzle") {
                        const hash = (Math.abs(lat) * 100 + Math.abs(lon) * 10) % 5;
                        baseTemp = 25.5 + (hash % 3);
                        baseWind = 10.0 + (hash % 2) * 3;
                        baseCode = 53;
                        baseRain = 1.0;
                    } else if (weatherScenario === "thunderstorm") {
                        const hash = (Math.abs(lat) * 100 + Math.abs(lon) * 10) % 5;
                        baseTemp = 22.5 + (hash % 3);
                        baseWind = 35.0 + hash * 4;
                        baseCode = 95;
                        baseRain = 15.0;
                    }

                    temp = baseTemp;
                    windspeed = baseWind;
                    weathercode = baseCode;
                    rain = baseRain;
                }

                return calculatePreciseWeatherDelay(temp, windspeed, rain, weathercode);
            };

            // Main AQI Effect Calculator
            const computeAqiEffects = (hubName) => {
                const live = aqiData[hubName];
                let aqi = null;
                let pm2_5 = null;
                let pm10 = null;
                
                if (live) {
                    aqi = live.aqi;
                    pm2_5 = live.pm2_5;
                    pm10 = live.pm10;
                }
                
                if (aqi === null || aqi === undefined) {
                    return { 
                        aqi: null, 
                        pm2_5: null, 
                        pm10: null, 
                        delay: 0, 
                        description: "Loading AQI...", 
                        icon: "fa-spinner animate-spin text-brandBlue" 
                    };
                }
                
                let delay = 0;
                let description = "Healthy Air";
                let icon = "";
                
                if (aqi > 150) {
                    delay = 30; // 30 mins smog delay
                    description = `Poor Air Quality / Smog (${aqi} AQI)`;
                    icon = "fa-smog text-red-500 animate-pulse";
                } else if (aqi > 100) {
                    delay = 15; // 15 mins haze delay
                    description = `Haze (${aqi} AQI)`;
                    icon = "fa-smog text-amber-500";
                }
                
                return { aqi, pm2_5, pm10, delay, description, icon };
            };

            // Deterministic Traffic delay model representing ingested historical traffic/transit delay data
            const getHistoricalTrafficDelay = (hubName, dateStr) => {
                let hash = 0;
                for (let i = 0; i < hubName.length; i++) hash += hubName.charCodeAt(i);
                for (let i = 0; i < dateStr.length; i++) hash += dateStr.charCodeAt(i);
                
                const dObj = new Date(dateStr + "T12:00:00");
                const dayOfWeek = dObj.getDay();
                const dayFactor = (dayOfWeek === 0 || dayOfWeek === 6) ? 0.35 : 1.0;
                
                const baseDelay = (hash % 22) + 5; // 5 to 26 mins of base traffic delay
                return Math.round(baseDelay * dayFactor);
            };

            // live traffic is resolved dynamically using TomTom or NH fallback

            // Precise Weather Delay Calculator
            const calculatePreciseWeatherDelay = (temp, windspeed, rain, weathercode = 0) => {
                if (temp === null || temp === undefined || isNaN(temp)) {
                    return {
                        temp: null,
                        windspeed: null,
                        rain: null,
                        weathercode: null,
                        delay: 0,
                        description: "Loading Weather...",
                        icon: "fa-spinner animate-spin text-brandBlue",
                        type: "loading"
                    };
                }
                let delay = 0;
                let description = "Clear Sky";
                let icon = "fa-sun text-yellow-400";
                let type = "clear";

                // Temperature fluctuations (Comfort zone is 20°C - 28°C)
                if (temp > 28) {
                    const excess = temp - 28;
                    const heatDelay = Math.round(excess * 4.5); // 4.5 mins delay per degree above 28°C
                    delay += heatDelay;
                    description = `Above Normal Heat (${Math.round(temp)}°C)`;
                    icon = "fa-temperature-high text-red-500 animate-pulse";
                    type = "heat";
                } else if (temp < 15) {
                    const excess = 15 - temp;
                    const coldDelay = Math.round(excess * 3); // 3 mins delay per degree below 15°C
                    delay += coldDelay;
                    description = `Chilly Weather (${Math.round(temp)}°C)`;
                    icon = "fa-temperature-low text-blue-300 animate-pulse";
                    type = "cold";
                }

                // Wind fluctuations
                if (windspeed > 15) {
                    const excess = windspeed - 15;
                    const windDelay = Math.round(excess * 2.5); // 2.5 mins delay per km/h above 15 km/h
                    delay += windDelay;
                    if (description === "Clear Sky") {
                        description = windspeed >= 50 ? "Gale Force Winds" : "Breezy Weather";
                    } else {
                        description = `${description} & Windy`;
                    }
                    icon = windspeed >= 50 ? "fa-wind text-teal-400 animate-pulse" : "fa-wind text-slate-300";
                    type = windspeed >= 50 ? "gale" : "windy";
                }

                // Rain/Precipitation fluctuations
                if (rain > 0 || [51,53,55,56,57,61,63,65,66,67,80,81,82].includes(weathercode)) {
                    let rainDelay = 0;
                    let rainDesc = "Rain";
                    
                    const isDrizzle = [51,53,55,56,57].includes(weathercode) || (rain > 0 && rain < 2);
                    const isModerateRain = [61,63].includes(weathercode) || (rain >= 2 && rain < 10);
                    const isHeavyRain = [65,66,67,80,81,82].includes(weathercode) || rain >= 10;

                    if (isDrizzle) {
                        rainDelay = 25; 
                        rainDesc = "Light Drizzle";
                        icon = "fa-cloud-rain text-blue-400";
                        type = "drizzle";
                    } else if (isModerateRain) {
                        rainDelay = 50; 
                        rainDesc = "Steady Rain";
                        icon = "fa-cloud-showers-heavy text-blue-500 animate-pulse";
                        type = "rain";
                    } else if (isHeavyRain) {
                        rainDelay = 85; 
                        rainDesc = "Torrential Downpour";
                        icon = "fa-cloud-showers-heavy text-red-500 animate-bounce";
                        type = "rain";
                    }
                    
                    delay += rainDelay;
                    if (description === "Clear Sky" || description.startsWith("Above Normal Heat") || description.startsWith("Chilly")) {
                        description = rainDesc;
                    } else {
                        description = `${description} & ${rainDesc}`;
                    }
                }

                // Thunderstorm fluctuations (WMO 95, 96, 99)
                if ([95, 96, 99].includes(weathercode)) {
                    delay += 110; 
                    description = description === "Clear Sky" ? "Severe Thunderstorm" : `${description} & Thunderstorm`;
                    icon = "fa-cloud-bolt text-purple-400 animate-pulse";
                    type = "thunderstorm";
                }

                // Fog fluctuations (WMO 45, 48)
                if ([45, 48].includes(weathercode)) {
                    delay += 45;
                    description = description === "Clear Sky" ? "Dense Fog" : `${description} & Fog`;
                    icon = "fa-smog text-slate-400";
                    type = "fog";
                }

                return { temp, windspeed, rain, weathercode, delay, description, icon, type };
            };


            // Recalculation Effect Pipeline
            useEffect(() => {
                if (rawOrders.length === 0) return;
                
                const today = new Date();
                const yyyy = today.getFullYear();
                const mm = String(today.getMonth() + 1).padStart(2, '0');
                const dd = String(today.getDate()).padStart(2, '0');
                const todayStr = `${yyyy}-${mm}-${dd}`;

                const getHubNews = (hubName) => {
                    const matching = newsAlerts.filter(n => n.hub === hubName);
                    return matching.length > 0 ? matching.reduce((max, cur) => cur.delay > max.delay ? cur : max, matching[0]) : null;
                };

                const updatedOrders = rawOrders.map(order => {
                    const coords = hubsCoords[order.RouteHub] || { lat: order.Latitude, lon: order.Longitude };
                    const isActive = (order.Status === "In Transit" || order.Status === "Delayed" || order.Status === "At Risk") && order.OrderDate === todayStr;
                    
                    let temp = null;
                    let windspeed = null;
                    let rain = null;
                    let weathercode = null;
                    
                    let weather = null;
                    let aqiInfo = { aqi: null, pm2_5: null, pm10: null, delay: 0, description: "No Data Available", icon: "" };
                    let trafficDelay = 0;
                    let trafficReason = "Optimal Traffic Flow";
                    let newsDelay = 0;
                    let newsReason = "";
                    let newsInfo = null;
                    let totalDelay = 0;
                    let reason = order.Reason;
                    
                    if (isActive) {
                        const liveDelays = calculateLiveDelays(order.RouteHub, order.OrderID, coords.lat, coords.lon);
                        totalDelay = liveDelays.totalDelay;
                        reason = liveDelays.reason;
                        weather = liveDelays.weatherInfo;
                        aqiInfo = liveDelays.aqiInfo;
                        trafficDelay = liveDelays.trafficDelay;
                        trafficReason = liveDelays.trafficReason;
                        newsDelay = liveDelays.newsDelay;
                        newsReason = liveDelays.newsReason;
                        newsInfo = liveDelays.newsInfo;
                    } else {
                        const history = historicalWeatherData[order.RouteHub];
                        if (history && history.dates) {
                            const dateIdx = history.dates.indexOf(order.OrderDate);
                            if (dateIdx !== -1) {
                                temp = history.temp[dateIdx];
                                windspeed = history.windspeed[dateIdx];
                                rain = history.rain[dateIdx];
                                weathercode = 0;
                            }
                        }
                        weather = calculatePreciseWeatherDelay(temp, windspeed, rain, weathercode);
                        trafficDelay = getHistoricalTrafficDelay(order.RouteHub, order.OrderDate);
                        trafficReason = trafficDelay > 18 ? "Peak Hours Traffic Ingestion" : "Standard Transit Delay";
                        totalDelay = weather.delay + trafficDelay;
                        reason = isActive ? "Clear & Optimal" : "Completed";
                    }
                    
                    let status = order.Status;
                    if (isActive) {
                        if (totalDelay > 60) {
                            status = "Delayed";
                        } else if (totalDelay > 20) {
                            status = "At Risk";
                        } else {
                            status = "In Transit";
                        }
                    } else {
                        status = "Delivered";
                    }
                    
                    const costPerMinute = order.Volume * 0.15 + 12;
                    const financialImpact = totalDelay > 0 ? Math.round(totalDelay * costPerMinute) : 0;
                    
                    const originName = order.SourceWarehouse || "Patna HQ DC";
                    const origin = warehouses[originName] || warehouses["Patna HQ DC"] || { name: "Patna HQ DC", lat: 25.5941, lon: 85.1376 };
                    
                    let baselineHours = 12.0;
                    if (originName === "Patna HQ DC") {
                        const hubBaseline = SCM_BASELINES[order.RouteHub] || { baselineHours: 12.0 };
                        baselineHours = hubBaseline.baselineHours;
                    } else {
                        const dist = haversineDistance(origin.lat, origin.lon, coords.lat, coords.lon);
                        baselineHours = Math.round((dist / 35.0 + 2.0) * 10) / 10;
                    }
                    
                    const delayedHours = baselineHours + (totalDelay / 60);
                    
                    let eta = order.ETA;
                    if (isActive) {
                        const totalTransitMins = Math.round(baselineHours * 60) + totalDelay;
                        eta = generateETA(order.OrderDate, totalTransitMins);
                    } else {
                        eta = "Completed";
                    }
                    
                    return {
                        ...order,
                        Status: status,
                        DelayTime: totalDelay,
                        FinancialImpact: financialImpact,
                        ETA: eta,
                        Reason: reason,
                        weatherInfo: weather,
                        aqiInfo: aqiInfo,
                        newsInfo: newsInfo,
                        BaselineTime: baselineHours,
                        DelayedTime: delayedHours
                    };
                });

                setOrders(updatedOrders);
                
                // Group orders by RouteHub for map routing representation
                const hubMap = {};
                updatedOrders.forEach(order => {
                    const name = order.RouteHub;
                    const coords = hubsCoords[name] || { lat: order.Latitude, lon: order.Longitude };
                    
                    if (!hubMap[name]) {
                        hubMap[name] = {
                            destination: name,
                            lat: coords.lat,
                            lon: coords.lon,
                            volume: 0,
                            status: "Delivered",
                            reasons: [],
                            delayTimes: [],
                            etas: [],
                            altPaths: [],
                            orders: [],
                            weather: computeWeatherEffects(name, coords.lat, coords.lon),
                            aqi: computeAqiEffects(name),
                            news: getHubNews(name)
                        };
                    }
                    const hub = hubMap[name];
                    hub.volume += order.Volume;
                    hub.orders.push(order);
                    if (order.Reason && order.Reason !== "Completed" && order.Reason !== "Clear") {
                        hub.reasons.push(order.Reason);
                    }
                    if (order.DelayTime > 0) {
                        hub.delayTimes.push(order.DelayTime);
                    }
                    if (order.ETA) {
                        hub.etas.push(order.ETA);
                    }
                    if (order.AltPath && order.AltPath !== "Standard Routing" && order.AltPath !== "Optimal Path Maintained") {
                        hub.altPaths.push(order.AltPath);
                    }
                    
                    const statusPriority = { "Delayed": 4, "At Risk": 3, "In Transit": 2, "Delivered": 1 };
                    if (statusPriority[order.Status] > statusPriority[hub.status]) {
                        hub.status = order.Status;
                    }
                });

                // Add remaining hubs from CSV (even if they have no active orders in orders.xlsx)
                Object.keys(hubsCoords).forEach(city => {
                    if (!hubMap[city]) {
                        const coords = hubsCoords[city];
                        const weather = computeWeatherEffects(city, coords.lat, coords.lon);
                        const aqiVal = computeAqiEffects(city);
                        hubMap[city] = {
                            destination: city,
                            lat: coords.lat,
                            lon: coords.lon,
                            volume: 0,
                            status: "Delivered",
                            reasons: [],
                            delayTimes: [],
                            etas: [],
                            altPaths: [],
                            orders: [],
                            weather: weather,
                            aqi: aqiVal,
                            news: getHubNews(city)
                        };
                    }
                });
                
                const computedRouteNetwork = Object.values(hubMap).map(hub => {
                    const delaySum = hub.delayTimes.reduce((a, b) => a + b, 0);
                    const delayText = delaySum > 0 ? `${Math.round(delaySum / hub.delayTimes.length)}m` : "0m";
                    const reason = hub.reasons.length > 0 ? Array.from(new Set(hub.reasons)).slice(0, 2).join(", ") : "Clear";
                    const eta = hub.status === "Delivered" ? "Completed" : (hub.etas[0] || "N/A");
                    const altPath = hub.altPaths.length > 0 ? hub.altPaths[0] : "Standard Routing";
                    
                    return {
                        id: hub.orders[0]?.OrderID || "N/A",
                        destination: hub.destination,
                        lat: hub.lat,
                        lon: hub.lon,
                        volume: hub.volume,
                        status: hub.status,
                        reason: reason,
                        delayText: delayText,
                        eta: eta,
                        altPath: altPath,
                        weather: hub.weather,
                        aqi: hub.aqi,
                        news: hub.news
                    };
                });
                setRouteNetwork(computedRouteNetwork);
                
                // Generate dynamic date strings relative to today
                const getNDaysAgoStr = (n) => {
                    const d = new Date();
                    d.setDate(d.getDate() - n);
                    const yyyy = d.getFullYear();
                    const mm = String(d.getMonth() + 1).padStart(2, '0');
                    const dd = String(d.getDate()).padStart(2, '0');
                    return `${yyyy}-${mm}-${dd}`;
                };

                const getNDaysAgoLabel = (n) => {
                    const d = new Date();
                    d.setDate(d.getDate() - n);
                    const month = d.toLocaleString('en-US', { month: 'short' });
                    const day = d.getDate();
                    return `${month} ${day}`;
                };

                const yesterdayStr = getNDaysAgoStr(1);
                
                // Get orders for today (live) and yesterday (raw/historical)
                const todayOrders = updatedOrders.filter(o => o.OrderDate === todayStr);
                const yesterdayOrdersRaw = rawOrders.filter(o => o.OrderDate === yesterdayStr);
                
                // 1. Total Deliveries (KPI 1)
                const overallTotal = updatedOrders.length;
                const todayTotal = todayOrders.length;
                const yesterdayTotal = yesterdayOrdersRaw.length;
                const totalChangePercent = yesterdayTotal > 0 
                    ? (((todayTotal - yesterdayTotal) / yesterdayTotal) * 100).toFixed(1) 
                    : "0.0";
                const totalChange = `${totalChangePercent >= 0 ? "▲" : "▼"} ${Math.abs(totalChangePercent)}% (${todayTotal} today vs ${yesterdayTotal} yesterday)`;
                const totalColor = totalChangePercent >= 0 ? "text-statusGreen" : "text-statusRed";
                
                // 2. On Time Ratio (KPI 2)
                const todayOnTimeCount = todayOrders.filter(o => o.Status === "Delivered" || (o.Status === "In Transit" && o.DelayTime === 0)).length;
                const todayOnTimeRatio = todayTotal > 0 ? (todayOnTimeCount / todayTotal) * 100 : 100;
                
                const yesterdayOnTimeCount = yesterdayOrdersRaw.filter(o => o.Status === "Delivered" || (o.Status === "In Transit" && o.DelayTime === 0)).length;
                const yesterdayOnTimeRatio = yesterdayTotal > 0 ? (yesterdayOnTimeCount / yesterdayTotal) * 100 : 100;
                
                const onTimeChangeDiff = (todayOnTimeRatio - yesterdayOnTimeRatio).toFixed(1);
                const onTimeChange = `${onTimeChangeDiff >= 0 ? "▲" : "▼"} ${Math.abs(onTimeChangeDiff)}% vs yesterday`;
                const onTimeColor = onTimeChangeDiff >= 0 ? "text-statusGreen" : "text-statusRed";
                
                // 3. Active Delays (KPI 3)
                const todayDelayed = todayOrders.filter(o => o.Status === "Delayed").length;
                const yesterdayDelayed = yesterdayOrdersRaw.filter(o => o.Status === "Delayed").length;
                const delayedChangeDiff = todayDelayed - yesterdayDelayed;
                const delayedChange = `${delayedChangeDiff >= 0 ? "▲" : "▼"} ${Math.abs(delayedChangeDiff)} vs yesterday`;
                const delayedColor = delayedChangeDiff <= 0 ? "text-statusGreen" : "text-statusRed";
                
                // 4. At Risk (KPI 4)
                const todayAtRisk = todayOrders.filter(o => o.Status === "At Risk").length;
                const yesterdayAtRisk = yesterdayOrdersRaw.filter(o => o.Status === "At Risk").length;
                const atRiskChangeDiff = todayAtRisk - yesterdayAtRisk;
                const atRiskChange = `${atRiskChangeDiff >= 0 ? "▲" : "▼"} ${Math.abs(atRiskChangeDiff)} vs yesterday`;
                const atRiskColor = atRiskChangeDiff <= 0 ? "text-statusGreen" : "text-statusOrange";
                
                // 5. Weather Impacted (KPI 5)
                const isWeatherImpacted = (o) => {
                    if (o.weatherInfo && o.weatherInfo.delay > 0) return true;
                    const r = (o.Reason || "").toLowerCase();
                    return r.includes("weather") || r.includes("fog") || r.includes("storm") || r.includes("rain") || r.includes("drizzle") || r.includes("thunderstorm") || r.includes("heat");
                };
                
                const todayWeather = todayOrders.filter(isWeatherImpacted).length;
                const yesterdayWeather = yesterdayOrdersRaw.filter(isWeatherImpacted).length;
                const weatherChangeDiff = todayWeather - yesterdayWeather;
                const weatherChange = `${weatherChangeDiff >= 0 ? "▲" : "▼"} ${Math.abs(weatherChangeDiff)} vs yesterday`;
                const weatherColor = weatherChangeDiff <= 0 ? "text-statusGreen" : "text-brandBlue";
                
                // 6. Est. Impact Cost (KPI 6)
                const todayCost = todayOrders.reduce((sum, o) => sum + (o.FinancialImpact || 0), 0);
                const yesterdayCost = yesterdayOrdersRaw.reduce((sum, o) => sum + (o.FinancialImpact || 0), 0);
                const costChangeDiff = todayCost - yesterdayCost;
                const financialChange = `${costChangeDiff >= 0 ? "▲" : "▼"} ₹${Math.abs(costChangeDiff).toLocaleString()} vs yesterday`;
                const financialColor = costChangeDiff <= 0 ? "text-statusGreen" : "text-statusRed";
                
                setKpiData({
                    total: overallTotal.toLocaleString(),
                    totalChange,
                    totalColor,
                    onTime: todayOnTimeRatio.toFixed(1) + "%",
                    onTimeChange,
                    onTimeColor,
                    delayed: todayDelayed,
                    delayedChange,
                    delayedColor,
                    atRisk: todayAtRisk,
                    atRiskChange,
                    atRiskColor,
                    weather: todayWeather,
                    weatherChange,
                    weatherColor,
                    financial: "₹" + todayCost.toLocaleString(),
                    financialChange,
                    financialColor
                });
                
                const todayDeliveredCount = todayOrders.filter(o => o.Status === "Delivered").length;
                const todayInTransitCount = todayOrders.filter(o => o.Status === "In Transit").length;
                
                setStatusCounts([todayDeliveredCount, todayInTransitCount, todayDelayed, todayAtRisk]);
                setWeatherCounts(todayWeather);
                
                const trafficDelaysCount = todayOrders.filter(o => {
                    const r = (o.Reason || "").toLowerCase();
                    return r.includes("traffic") || r.includes("accident") || r.includes("blockage") || r.includes("protest");
                }).length;
                setTrafficCounts(trafficDelaysCount);
                
                // Compute Financial trend data dynamically for the last 7 days
                const trendDates = [];
                const trendDateMap = {};
                for (let i = 6; i >= 0; i--) {
                    const dateStr = getNDaysAgoStr(i);
                    const label = getNDaysAgoLabel(i);
                    trendDates.push(label);
                    trendDateMap[dateStr] = label;
                }
                
                const dailyCosts = {};
                trendDates.forEach(d => { dailyCosts[d] = 0; });
                
                updatedOrders.forEach(o => {
                    const dateLabel = trendDateMap[o.OrderDate];
                    if (dateLabel) {
                        dailyCosts[dateLabel] += o.FinancialImpact || 0;
                    }
                });
                setFinancialOverheadTrend(trendDates.map(d => dailyCosts[d]));
                
                // Set recent delays
                const delays = updatedOrders
                    .filter(o => o.DelayTime > 0)
                    .sort((a, b) => b.DelayTime - a.DelayTime)
                    .slice(0, 40)
                    .map(o => ({
                        id: o.OrderID,
                        destination: o.RouteHub,
                        reason: o.Reason,
                        delayTime: o.DelayTime,
                        delayText: o.DelayTime >= 60 ? `${Math.floor(o.DelayTime / 60)}h ${o.DelayTime % 60}m` : `${o.DelayTime}m`,
                        status: o.Status,
                        eta: o.ETA,
                        financialImpact: o.FinancialImpact,
                        volume: o.Volume || 0,
                        date: o.OrderDate || "",
                        baselineTime: o.BaselineTime,
                        delayedTime: o.DelayedTime
                    }));
                setRecentDelays(delays);
                
            }, [rawOrders, hubsCoords, warehouses, weatherData, weatherScenario, historicalWeatherData, tomtomTrafficData, newsAlerts, aqiData]);

            // Dynamic Weather, AQI, News & Traffic API Ingestion Sequence
            useEffect(() => {
                if (Object.keys(hubsCoords).length === 0) return;
                const initializeLiveFeeds = async () => {
                    await fetchTrafficData(hubsCoords);
                    await fetchWeatherDataAndAqiAndNews(hubsCoords);
                };
                initializeLiveFeeds();
            }, [hubsCoords]);

            // Separate Effect/Callback to update/re-render thermal overlay dynamically on zoom/pan
            const updateThermalOverlay = useCallback(() => {
                if (!mapRef.current || !showThermalMap || routeNetwork.length === 0) {
                    if (thermalLayerRef.current) {
                        mapRef.current.removeLayer(thermalLayerRef.current);
                        thermalLayerRef.current = null;
                    }
                    return;
                }
                
                // Clear any existing thermal layer group
                if (thermalLayerRef.current) {
                    mapRef.current.removeLayer(thermalLayerRef.current);
                    thermalLayerRef.current = null;
                }
                
                thermalLayerRef.current = L.layerGroup().addTo(mapRef.current);
                
                const hqTempMatch = hqWeather.match(/(\d+)/);
                const hqTempValue = hqTempMatch ? parseFloat(hqTempMatch[1]) : null;
                
                let patnaTemp = hqTempValue;
                if (weatherScenario !== "live") {
                    patnaTemp = computeWeatherEffects("Patna, BR", centralWarehouse.lat, centralWarehouse.lon).temp;
                }
                
                const sources = [];
                Object.values(warehouses).forEach(w => {
                    let wTemp = null;
                    if (weatherScenario === "live") {
                        wTemp = weatherData[w.name] ? weatherData[w.name].temp : null;
                    } else {
                        wTemp = computeWeatherEffects(w.name, w.lat, w.lon).temp;
                    }
                    if (wTemp !== null && wTemp !== undefined && !isNaN(wTemp)) {
                        sources.push({ lat: w.lat, lon: w.lon, temp: wTemp });
                    }
                });
                
                routeNetwork.forEach(loc => {
                    const temp = loc.weather ? loc.weather.temp : null;
                    if (temp !== null && temp !== undefined && !isNaN(temp)) {
                        sources.push({ lat: loc.lat, lon: loc.lon, temp });
                    }
                });
                
                if (sources.length > 0) {
                    // Dynamic bounds based on current visible map area
                    const bounds = mapRef.current.getBounds();
                    const minLat = bounds.getSouth();
                    const maxLat = bounds.getNorth();
                    const minLon = bounds.getWest();
                    const maxLon = bounds.getEast();
                    
                    // Create in-memory canvas for smooth gradient rendering
                    const canvas = document.createElement('canvas');
                    const width = 120; // 120x120 resolution is perfect for smooth bilinear upscale by browser
                    const height = 120;
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    const imgData = ctx.createImageData(width, height);
                    const data = imgData.data;
                    
                    // Helper to interpolate temperature to RGBA values
                    const getTemperatureColorRGBA = (t) => {
                        if (t <= 15) return { r: 59, g: 130, b: 246, a: Math.round(0.35 * 255) };
                        if (t >= 45) return { r: 239, g: 68, b: 68, a: Math.round(0.65 * 255) };
                        
                        if (t < 28) {
                            const r = (t - 15) / 13;
                            const red = Math.round(59 + (16 - 59) * r);
                            const green = Math.round(130 + (185 - 130) * r);
                            const blue = Math.round(246 + (129 - 246) * r);
                            const alpha = 0.35 + (0.45 - 0.35) * r;
                            return { r: red, g: green, b: blue, a: Math.round(alpha * 255) };
                        } else if (t < 36) {
                            const r = (t - 28) / 8;
                            const red = Math.round(16 + (245 - 16) * r);
                            const green = Math.round(185 + (158 - 185) * r);
                            const blue = Math.round(129 + (11 - 129) * r);
                            const alpha = 0.45 + (0.55 - 0.45) * r;
                            return { r: red, g: green, b: blue, a: Math.round(alpha * 255) };
                        } else {
                            const r = (t - 36) / 9;
                            const red = Math.round(245 + (239 - 245) * r);
                            const green = Math.round(158 + (68 - 158) * r);
                            const blue = Math.round(11 + (68 - 11) * r);
                            const alpha = 0.55 + (0.65 - 0.55) * r;
                            return { r: red, g: green, b: blue, a: Math.round(alpha * 255) };
                        }
                    };
                    
                    for (let r = 0; r < height; r++) {
                        const lat = maxLat - (r / (height - 1)) * (maxLat - minLat);
                        for (let c = 0; c < width; c++) {
                            const lon = minLon + (c / (width - 1)) * (maxLon - minLon);
                            
                            let weightedSum = 0;
                            let weightSum = 0;
                            let exactMatch = null;
                            
                            for (const src of sources) {
                                const distSq = Math.pow(lat - src.lat, 2) + Math.pow(lon - src.lon, 2);
                                if (distSq < 0.0005) {
                                    exactMatch = src.temp;
                                    break;
                                }
                                const weight = 1 / Math.pow(distSq, 1.25);
                                weightedSum += src.temp * weight;
                                weightSum += weight;
                            }
                            
                            const temp = exactMatch !== null ? exactMatch : (weightSum > 0 ? (weightedSum / weightSum) : null);
                            
                            // Distance fading for soft edges
                            let minDistance = Infinity;
                            for (const src of sources) {
                                const dist = Math.hypot(lat - src.lat, lon - src.lon);
                                if (dist < minDistance) {
                                    minDistance = dist;
                                }
                            }
                            
                            let distanceMultiplier = 1.0;
                            if (minDistance > 1.2) {
                                distanceMultiplier = Math.max(0, 1.0 - (minDistance - 1.2) / 2.3);
                            }
                            
                            let rVal = 0, gVal = 0, bVal = 0, aVal = 0;
                            if (temp !== null && temp !== undefined && !isNaN(temp)) {
                                const color = getTemperatureColorRGBA(temp);
                                rVal = color.r;
                                gVal = color.g;
                                bVal = color.b;
                                aVal = Math.round(color.a * distanceMultiplier);
                            }
                            
                            const idx = (r * width + c) * 4;
                            data[idx] = rVal;
                            data[idx + 1] = gVal;
                            data[idx + 2] = bVal;
                            data[idx + 3] = aVal;
                        }
                    }
                    ctx.putImageData(imgData, 0, 0);
                    
                    L.imageOverlay(canvas.toDataURL(), [
                        [minLat, minLon],
                        [maxLat, maxLon]
                    ], {
                        opacity: 0.85,
                        interactive: false
                    }).addTo(thermalLayerRef.current);
                }
            }, [routeNetwork, showThermalMap, hqWeather, weatherScenario]);

            // Keep reference updated to prevent stale closures in event handlers
            updateThermalOverlayRef.current = updateThermalOverlay;

            // Trigger updates whenever dependencies change
            useEffect(() => {
                updateThermalOverlay();
            }, [updateThermalOverlay]);

            // Leaflet Map Initialization & Destruction Effect
            useEffect(() => {
                if (activeTab === "overview" && !loading) {
                    if (!mapRef.current) {
                        const map = L.map('leaflet-frame', { zoomControl: false }).setView([23.5, 88.0], 6);
                        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
                        
                        mapRef.current = map;
                        mapLayersRef.current = L.layerGroup().addTo(map);

                        // Bind pan/zoom events for dynamic thermal overlay recalculation
                        map.on('moveend', () => {
                            if (updateThermalOverlayRef.current) {
                                updateThermalOverlayRef.current();
                            }
                        });
                        map.on('zoomend', () => {
                            if (updateThermalOverlayRef.current) {
                                updateThermalOverlayRef.current();
                            }
                        });

                        setTimeout(() => {
                            if (mapRef.current) {
                                mapRef.current.invalidateSize();
                            }
                        }, 200);
                    }
                } else if (activeTab === "weather") {
                    if (mapRef.current) {
                        mapRef.current.remove();
                        mapRef.current = null;
                        mapLayersRef.current = null;
                        thermalLayerRef.current = null;
                    }
                }
            }, [activeTab, loading]);

            // Plot markers and routes when routeNetwork changes
            useEffect(() => {
                if (loading || activeTab !== "overview" || !mapRef.current || !mapLayersRef.current || routeNetwork.length === 0) return;
                mapLayersRef.current.clearLayers();

                // Add Patna HQ Marker dynamically so that it updates when hqWeather or weatherScenario changes
                const activeHqWeatherStr = getActiveHqWeather();
                L.circleMarker([centralWarehouse.lat, centralWarehouse.lon], {
                    radius: 8, color: '#2563eb', fillColor: '#ffffff', fillOpacity: 1, weight: 3
                }).addTo(mapLayersRef.current).bindPopup(`
                    <div class="text-xs font-sans text-slate-800">
                        <b>${centralWarehouse.name}</b><br/>
                        <span>Central Logistics Hub</span><br/>
                        <span class="text-[10px] text-slate-500">HQ Temperature: <b>${activeHqWeatherStr}</b></span>
                    </div>
                `);
                
                // Thermal overlay is updated by the updateThermalOverlay callback and event listeners

                routeNetwork.forEach(loc => {
                    const colorCode = loc.status === "Delayed" ? "#ef4444" : (loc.status === "At Risk" ? "#f59e0b" : "#10b981");
                    const w = loc.weather || { temp: null, windspeed: null, description: "Loading Weather...", icon: "fa-spinner animate-spin text-brandBlue" };
                    const a = loc.aqi || { aqi: null, pm2_5: null, pm10: null };

                    const aqiColor = a.aqi !== null ? (a.aqi > 150 ? '#ef4444' : (a.aqi > 100 ? '#f59e0b' : '#10b981')) : '#64748b';
                    const aqiText = a.aqi !== null ? `${a.aqi} AQI` : '--';
                    const tempText = w.temp !== null ? `${Math.round(w.temp)}°C` : '--';
                    const pm25Text = a.pm2_5 !== null ? a.pm2_5 : '--';

                    // Add marker for route hub
                    L.circleMarker([loc.lat, loc.lon], {
                        radius: 6 + Math.min(4, loc.volume / 1000),
                        color: colorCode, 
                        fillColor: '#131c2e', 
                        fillOpacity: 1, 
                        weight: 2
                    }).addTo(mapLayersRef.current).bindPopup(`
                        <div class="text-xs font-sans text-slate-800" style="min-width: 150px;">
                            <div class="font-bold border-b border-slate-200 pb-1 mb-1">Hub: ${loc.destination}</div>
                            <span class="capitalize">Status: <span class="font-bold" style="color:${colorCode}">${loc.status}</span></span><br/>
                            <span>Volume: <b>${loc.volume.toLocaleString()} kg</b></span><br/>
                            <span>Avg Delay: <b>${loc.delayText}</b></span><br/>
                            <div class="text-[10px] text-slate-600 mt-1 max-h-16 overflow-y-auto pr-1">
                                <b>Route Incidents:</b> ${loc.reason}
                            </div>
                            <hr class="my-1 border-slate-200" />
                            <div class="flex items-center gap-1.5 mt-1 text-[10px] text-slate-600">
                                <i class="fa-solid ${w.icon}"></i>
                                <span>Weather: <b>${w.description}</b></span>
                            </div>
                            <div class="flex items-center gap-1.5 mt-1 text-[10px] text-slate-600">
                                <i class="fa-solid fa-smog text-amber-500"></i>
                                <span>Air Quality: <b style="color:${aqiColor}">${aqiText}</b></span>
                            </div>
                            <div class="flex justify-between items-center text-[10px] text-slate-500 mt-1 pt-1 border-t border-slate-100">
                                <span>Temp: <b>${tempText}</b></span>
                                <span>PM2.5: <b>${pm25Text}</b></span>
                            </div>
                        </div>
                    `);

                    // Route geometry extraction
                    fetch(`https://router.project-osrm.org/route/v1/driving/${centralWarehouse.lon},${centralWarehouse.lat};${loc.lon},${loc.lat}?overview=full&geometries=geojson`)
                        .then(r => r.json())
                        .then(data => {
                            if (data.routes && data.routes[0]) {
                                const pathCoords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
                                L.polyline(pathCoords, {
                                    color: colorCode,
                                    weight: loc.status === "Delayed" ? 3 : 2,
                                    dashArray: loc.status === "Delayed" ? "4, 6" : null,
                                    opacity: 0.8
                                }).addTo(mapLayersRef.current);
                            }
                        }).catch(() => {
                            L.polyline([[centralWarehouse.lat, centralWarehouse.lon], [loc.lat, loc.lon]], { color: colorCode, weight: 1.5 }).addTo(mapLayersRef.current);
                        });
                });

                // Fit view to bounds
                const points = [
                    [centralWarehouse.lat, centralWarehouse.lon],
                    ...routeNetwork.map(loc => [loc.lat, loc.lon])
                ];
                
                // Force size recalculation
                setTimeout(() => {
                    if (mapRef.current) {
                        mapRef.current.invalidateSize();
                    }
                }, 200);
            }, [routeNetwork, loading, weatherData, hqWeather, weatherScenario, activeTab, warehouses]);

            // Donut chart updates
            useEffect(() => {
                if (activeTab === "overview" && donutChartRef.current && statusCounts.some(c => c > 0)) {
                    if (donutChartInstanceRef.current) {
                        donutChartInstanceRef.current.destroy();
                    }
                    const ctx = donutChartRef.current.getContext('2d');
                    donutChartInstanceRef.current = new Chart(ctx, {
                        type: 'doughnut',
                        data: {
                            labels: ['Delivered', 'In Transit', 'Delayed', 'At Risk'],
                            datasets: [{
                                data: statusCounts,
                                backgroundColor: ['#10b981', '#2563eb', '#ef4444', '#f59e0b'],
                                borderWidth: 0
                            }]
                        },
                        options: {
                            responsive: true, 
                            maintainAspectRatio: false,
                            plugins: { legend: { display: false } },
                            cutout: '75%'
                        }
                    });
                }
                return () => {
                    if (donutChartInstanceRef.current) {
                        donutChartInstanceRef.current.destroy();
                        donutChartInstanceRef.current = null;
                    }
                };
            }, [statusCounts, activeTab]);

            // Bar chart updates
            useEffect(() => {
                if (activeTab === "overview" && barChartRef.current && financialOverheadTrend.length > 0) {
                    if (barChartInstanceRef.current) {
                        barChartInstanceRef.current.destroy();
                    }
                    const ctx = barChartRef.current.getContext('2d');
                    // Generate dynamic chart labels for the last 7 days
                    const chartLabels = [];
                    for (let i = 6; i >= 0; i--) {
                        const d = new Date();
                        d.setDate(d.getDate() - i);
                        const label = `${d.toLocaleString('en-US', { month: 'short' })} ${d.getDate()}`;
                        chartLabels.push(label);
                    }
                    
                    barChartInstanceRef.current = new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: chartLabels,
                            datasets: [{
                                label: 'Impact Cost',
                                data: financialOverheadTrend,
                                backgroundColor: '#ef4444',
                                borderRadius: 3
                            }]
                        },
                        options: {
                            responsive: true, 
                            maintainAspectRatio: false,
                            plugins: { legend: { display: false } },
                            scales: {
                                x: { grid: { display: false }, ticks: { color: theme === 'dark' ? '#64748b' : '#475569', font: { size: 9 } } },
                                y: { grid: { color: theme === 'dark' ? '#1e293b' : '#e2e8f0' }, ticks: { color: theme === 'dark' ? '#64748b' : '#475569', font: { size: 9 } } }
                            }
                        }
                    });
                }
                return () => {
                    if (barChartInstanceRef.current) {
                        barChartInstanceRef.current.destroy();
                        barChartInstanceRef.current = null;
                    }
                };
            }, [financialOverheadTrend, activeTab, theme]);

            if (loading) {
                return (
                    <div className="h-screen w-screen flex flex-col items-center justify-center preloader-container text-slate-200">
                        <div className="flex flex-col items-center preloader-card p-10 rounded-2xl backdrop-blur-lg shadow-2xl relative w-[420px] max-w-full">
                            {/* Animated Sorting & Delivery Logistics Flow */}
                            <div className="preloader-logistics-flow">
                                <div className="logistics-station sorting-station">
                                    <i className="fa-solid fa-boxes-packing preloader-icon-blue text-xl"></i>
                                    <div className="sorting-laser-line"></div>
                                </div>
                                
                                <div className="logistics-route">
                                    <div className="route-dot-path"></div>
                                    <div className="logistics-carrier">
                                        <i className="fa-solid fa-truck-fast carrier-truck text-amber-500"></i>
                                        <div className="carrier-package">
                                            <i className="fa-solid fa-box text-[8px] text-white"></i>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="logistics-station delivery-station">
                                    <i className="fa-solid fa-house-chimney text-slate-400 text-lg"></i>
                                    <div className="delivery-pulse"></div>
                                </div>
                            </div>
                            
                            <div className="text-center font-sans mt-4">
                                <h2 className="text-base font-extrabold tracking-widest text-white flex items-center justify-center gap-2">
                                    <span className="w-2.5 h-2.5 preloader-progress-bar rounded-full animate-pulse"></span>
                                    MISSION CONTROL
                                </h2>
                                <p className="text-[10px] text-slate-400 font-semibold tracking-wider mt-1">SUPPLY CHAIN MONITOR</p>
                                <div className="mt-6 flex flex-col items-center gap-2">
                                    <div className="w-48 h-1 bg-slate-900 rounded-full overflow-hidden border border-borderSlate">
                                        <div className="h-full preloader-progress-bar rounded-full animate-pulse" style={{ width: '60%' }}></div>
                                    </div>
                                    <p className="text-[9px] preloader-stage-text font-mono uppercase tracking-widest mt-1 animate-pulse">{loadingStage}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            }

            return (
                <div className="flex h-full w-full select-none">
                    <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} theme={theme} toggleTheme={toggleTheme} />

                    <div className="flex-1 flex flex-col min-w-0 bg-darkBg h-full overflow-visible">
                        <Topbar 
                            hqWeather={getActiveHqWeather()} 
                            weatherScenario={weatherScenario} 
                            systemTime={systemTime}
                            refreshTimer={refreshTimer}
                            onOpenSettings={() => setSettingsOpen(true)}
                            weatherSourceString={weatherSourceString}
                            lastFetchTime={lastFetchTime}
                            isRefreshing={isRefreshing}
                            onManualRefresh={handleManualRefresh}
                            lastOrdersFetch={lastOrdersFetch}
                            lastTrafficFetch={lastTrafficFetch}
                            lastWeatherFetch={lastWeatherFetch}
                            lastAqiFetch={lastAqiFetch}
                            lastNewsFetch={lastNewsFetch}
                            refreshingOrders={refreshingOrders}
                            refreshingTraffic={refreshingTraffic}
                            refreshingWeather={refreshingWeather}
                            refreshingAqi={refreshingAqi}
                            refreshingNews={refreshingNews}
                            onRefreshOrders={refreshOrdersOnly}
                            onRefreshTraffic={refreshTrafficOnly}
                            onRefreshWeather={refreshWeatherOnly}
                            onRefreshAqi={refreshAqiOnly}
                            onRefreshNews={refreshNewsOnly}
                            apiPanelOpen={apiPanelOpen}
                            onToggleApiPanel={() => setApiPanelOpen(!apiPanelOpen)}
                            onCloseApiPanel={() => setApiPanelOpen(false)}
                            activeTab={activeTab}
                            setActiveTab={setActiveTab}
                        />
                        
                        {activeTab === "overview" && (
                            <div className="flex-1 p-4 overflow-y-auto space-y-4 custom-scrollbar">
                                <KPIGrid data={kpiData} />
 
                            {/* Middle Tier Map and Right Panel Workspace Split */}
                            <div className="flex gap-4 h-[440px]">
                                
                                {/* Left Large Map Block */}
                                <div className="flex-1 bg-panelBg border border-borderSlate rounded-xl p-3 flex flex-col min-w-0">
                                    <div className="flex justify-between items-center mb-2">
                                        <h3 className="text-xs font-bold text-white uppercase tracking-wider">Live Map Overview</h3>
                                        <div className="flex items-center gap-3 text-[10px] text-slate-400">
                                            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-brandBlue"></span>Hub Base</span>
                                            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-statusGreen"></span>On-Time</span>
                                            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-statusOrange"></span>At Risk</span>
                                            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-statusRed"></span>Disruption</span>
                                        </div>
                                    </div>
                                    <div className="flex-1 relative rounded-lg overflow-hidden border border-borderSlate bg-slate-950">
                                        <div className="w-full h-full" id="leaflet-frame"></div>
                                        {/* Floating Map Controls */}
                                        <button 
                                            onClick={fitAllMarkers}
                                            className="absolute top-3 right-3 z-[1000] bg-panelBg/95 hover:bg-brandBlue text-slate-200 hover:text-white border border-borderSlate hover:border-brandBlue/50 text-[11px] font-bold px-3 py-1.5 rounded-lg shadow-lg hover:shadow-brandBlue/20 transition-all duration-200 flex items-center gap-1.5 active:scale-95 cursor-pointer group"
                                            title="Fit & Zoom Out to Show All Hubs and Destinations"
                                        >
                                            <i className="fa-solid fa-expand text-brandBlue group-hover:text-white transition-colors"></i>
                                            Fit Map View
                                        </button>

                                        {/* Floating Weather Control Center */}
                                        <div className="absolute bottom-3 left-3 z-[1000] bg-panelBg/95 border border-borderSlate p-3 rounded-xl shadow-2xl backdrop-blur-md w-64 text-xs font-sans">
                                            <div className="flex justify-between items-center border-b border-borderSlate/60 pb-1.5 mb-2">
                                                <span className="font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                                                    <i className="fa-solid fa-sliders text-brandBlue animate-pulse"></i>
                                                    Weather Control Panel
                                                </span>
                                            </div>
                                            
                                            {/* Thermal Map Toggle */}
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="text-slate-300 font-medium">Thermal Overlay</span>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={showThermalMap} 
                                                        onChange={(e) => setShowThermalMap(e.target.checked)}
                                                        className="sr-only peer"
                                                    />
                                                    <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brandBlue"></div>
                                                </label>
                                            </div>

                                            {/* Weather Scenario Dropdown */}
                                            <div className="space-y-1 mb-3">
                                                <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">Simulate Weather Profile</span>
                                                <select 
                                                    value={weatherScenario}
                                                    onChange={(e) => setWeatherScenario(e.target.value)}
                                                    className="w-full bg-slate-900 border border-borderSlate text-white text-[11px] rounded p-1.5 outline-none focus:border-brandBlue transition cursor-pointer"
                                                >
                                                    <option value="live">Live Weather Feed (Cascade)</option>
                                                    <option value="heatwave">🔥 Extreme Heatwave (&gt;42°C)</option>
                                                    <option value="thunderstorm">⛈️ Severe Thunderstorms</option>
                                                    <option value="storm">🌪️ Cyclonic Wind Storm</option>
                                                    <option value="gale">💨 Gale Force Winds (60 km/h)</option>
                                                    <option value="rain">🌧️ Monsoon Heavy Rain</option>
                                                    <option value="drizzle">🌦️ Light Drizzle</option>
                                                </select>
                                            </div>

                                            {/* Thermal Legend */}
                                            {showThermalMap && (
                                                <div className="space-y-1 border-t border-borderSlate/40 pt-2 text-[10px]">
                                                    <div className="flex justify-between text-slate-400 mb-1">
                                                        <span>Temp Distribution</span>
                                                        <span className="font-mono font-bold">20°C - 40°C</span>
                                                    </div>
                                                    <div className="h-2 w-full rounded bg-gradient-to-r from-blue-500 via-emerald-500 via-amber-400 via-orange-400 to-red-600"></div>
                                                    <div className="flex justify-between text-slate-500 text-[8px] mt-0.5 font-semibold">
                                                        <span>Cool (20°C)</span>
                                                        <span>Hot (35°C+)</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
 
                                {/* Right Stack Column */}
                                <div className="w-80 flex flex-col gap-4 shrink-0">
                                    {/* Active Critical Alerts */}
                                    <div className="h-1/2 bg-panelBg border border-borderSlate rounded-xl p-3 flex flex-col">
                                        <div className="flex justify-between items-center mb-2">
                                            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Active Alerts</h3>
                                            <span className="text-[10px] text-brandBlue font-medium">Live Feed</span>
                                        </div>
                                        <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar text-[11px]">
                                            {newsAlerts.length === 0 ? (
                                                <div className="text-slate-400 text-center py-4 flex flex-col items-center justify-center gap-2">
                                                    <i className="fa-solid fa-spinner animate-spin text-lg text-brandBlue"></i>
                                                    <span>Ingesting news & traffic streams...</span>
                                                </div>
                                            ) : (
                                                newsAlerts.map((alertItem, idx) => (
                                                    <a href={alertItem.link} target="_blank" rel="noopener noreferrer" key={alertItem.id || idx} className="block p-2 bg-slate-900/60 hover:bg-slate-800/40 rounded-lg border border-borderSlate flex gap-2 transition group">
                                                        <i className={`fa-solid ${alertItem.icon || "fa-triangle-exclamation"} mt-0.5 text-xs ${
                                                            alertItem.risk === "Critical" ? "text-statusRed animate-pulse" :
                                                            alertItem.risk === "High" ? "text-statusOrange animate-pulse" :
                                                            alertItem.risk === "Medium" ? "text-statusOrange" : "text-statusGreen"
                                                        }`}></i>
                                                        <div className="flex-1">
                                                            <div className="flex justify-between items-start">
                                                                <span className="font-bold text-slate-200 block group-hover:text-brandBlue transition">{alertItem.hub.split(",")[0]}: {alertItem.title}</span>
                                                                <span className={`text-[8px] font-bold px-1 rounded uppercase shrink-0 ml-1 ${
                                                                    alertItem.risk === "Critical" ? "bg-red-950/40 text-statusRed border border-statusRed/30" :
                                                                    alertItem.risk === "High" ? "bg-orange-950/40 text-statusOrange border border-statusOrange/30" :
                                                                    alertItem.risk === "Medium" ? "bg-amber-950/40 text-statusOrange border border-amber-500/20" : "bg-emerald-950/40 text-statusGreen border border-statusGreen/20"
                                                                }`}>{alertItem.risk}</span>
                                                            </div>
                                                            <p className="text-[10px] text-slate-400 mt-0.5">{alertItem.desc}</p>
                                                            <div className="flex justify-between items-center mt-1 text-[8px] text-slate-500">
                                                                <span>Delay Impact: <b className="text-amber-400 font-mono">+{alertItem.delay}m</b></span>
                                                                <span>{alertItem.pubDate}</span>
                                                            </div>
                                                        </div>
                                                    </a>
                                                ))
                                            )}
                                        </div>
                                    </div>
 
                                    {/* Route Optimization Adjustments */}
                                    <div className="h-1/2 bg-panelBg border border-borderSlate rounded-xl p-3 flex flex-col border-t-2 border-t-brandBlue">
                                        <div className="flex justify-between items-center mb-2">
                                            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Recommended Route Adjustments</h3>
                                        </div>
                                        <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar text-[11px]">
                                            {orders.filter(o => o.Status === "Delayed" || o.Status === "At Risk").slice(0, 2).map((o, idx) => (
                                                <div key={idx} className="p-2 bg-slate-900/60 rounded-lg border border-borderSlate space-y-1.5 mb-2">
                                                    <div className="flex justify-between items-center">
                                                        <span className="font-bold text-brandBlue">{o.OrderID}</span>
                                                        <span className="bg-statusOrange/10 text-statusOrange text-[9px] font-bold px-1 rounded">{o.Status}</span>
                                                    </div>
                                                    <p className="text-[10px] text-slate-400">Patna &rarr; {o.RouteHub}</p>
                                                    <div className="bg-slate-950 p-1.5 rounded text-[10px] text-statusGreen">
                                                        <b>Alt Track:</b> {o.AltPath}
                                                    </div>
                                                    <button onClick={() => alert(`Rerouting protocol triggered instantly for ${o.OrderID}.`)} className="w-full bg-brandBlue hover:bg-blue-700 text-white font-bold py-1 rounded text-[10px] transition">Apply Route</button>
                                                </div>
                                            ))}
                                            {orders.filter(o => o.Status === "Delayed" || o.Status === "At Risk").length === 0 && (
                                                <p className="text-[10px] text-slate-400 text-center py-4">No route adjustments required.</p>
                                            )}
                                        </div>
                                    </div>
 
                                </div>
                            </div>
 
                            {/* Bottom Analytic Dashboard Row */}
                            <div className="grid grid-cols-6 gap-4 h-48 shrink-0">
                                
                                {/* Block 1: Pipeline Volumetric Status Chart */}
                                <div className="bg-panelBg border border-borderSlate rounded-xl p-3 flex flex-col h-full overflow-hidden">
                                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Delivery Status</h4>
                                    <div className="flex-1 flex items-center relative">
                                        <div className="w-16 h-16 shrink-0 relative">
                                            <canvas ref={donutChartRef}></canvas>
                                        </div>
                                        <div className="ml-3 text-[10px] text-slate-400 space-y-1 w-full">
                                            <div className="flex justify-between"><span>Delivered</span><span className="text-statusGreen font-bold">{statusCounts[0]}</span></div>
                                            <div className="flex justify-between"><span>In Transit</span><span className="text-brandBlue font-bold">{statusCounts[1]}</span></div>
                                            <div className="flex justify-between"><span>Delayed</span><span className="text-statusRed font-bold">{statusCounts[2]}</span></div>
                                            <div className="flex justify-between"><span>At Risk</span><span className="text-statusOrange font-bold">{statusCounts[3]}</span></div>
                                        </div>
                                    </div>
                                </div>
 
                                {/* Block 2: Live Tracking Logs */}
                                <div className="col-span-2 bg-panelBg border border-borderSlate rounded-xl p-3 flex flex-col min-w-0 h-full overflow-hidden">
                                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Recent Delays</h4>
                                    <div className="flex-1 overflow-y-auto custom-scrollbar animate-fadeIn">
                                        <table className="w-full table-fixed text-[11px] text-left text-slate-300">
                                            <thead>
                                                <tr className="text-slate-500 border-b border-borderSlate text-[10px] uppercase">
                                                    <th className="pb-1 w-16">ID</th>
                                                    <th className="pb-1 w-24">Route Hub</th>
                                                    <th className="pb-1">Trigger Reason</th>
                                                    <th className="pb-1 w-20 text-right">Delay Time</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-borderSlate/40">
                                                {recentDelays.map((r, i) => (
                                                    <tr 
                                                        key={i} 
                                                        className="hover:bg-slate-800/30 cursor-pointer transition-colors"
                                                        onMouseEnter={() => setHoveredDelay(r)}
                                                        onMouseLeave={() => setHoveredDelay(null)}
                                                        onMouseMove={(e) => {
                                                            let calculatedTop = e.clientY - 195;
                                                            if (calculatedTop < 10) {
                                                                calculatedTop = e.clientY + 15;
                                                            }
                                                            let calculatedLeft = e.clientX - 130;
                                                            if (calculatedLeft < 10) {
                                                                calculatedLeft = 10;
                                                            } else if (calculatedLeft > window.innerWidth - 270) {
                                                                calculatedLeft = window.innerWidth - 270;
                                                            }
                                                            setTooltipPos({
                                                                top: calculatedTop,
                                                                left: calculatedLeft
                                                            });
                                                        }}
                                                    >
                                                        <td className="py-1 text-brandBlue font-mono truncate">{r.id}</td>
                                                        <td className="py-1 truncate">{r.destination}</td>
                                                        <td className="py-1 text-slate-400 truncate">{r.reason}</td>
                                                        <td className="py-1 text-right text-statusRed font-semibold whitespace-nowrap">+{r.delayText}</td>
                                                    </tr>
                                                ))}
                                                {recentDelays.length === 0 && (
                                                    <tr>
                                                        <td colSpan="4" className="py-4 text-center text-slate-500">No active delays reported.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
 
                                {/* Block 3: Categorized Disruption Sources */}
                                <div className="bg-panelBg border border-borderSlate rounded-xl p-3 flex flex-col justify-between h-full overflow-hidden">
                                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Disruption Sources</h4>
                                    <div className="grid grid-cols-2 gap-2 text-center text-xs">
                                        <div className="bg-slate-900/60 p-2 rounded-lg border border-borderSlate">
                                            <i className={`fa-solid fa-cloud-bolt text-brandBlue mb-1 block text-lg ${weatherScenario !== 'live' ? 'animate-pulse text-statusPurple' : ''}`}></i>
                                            <span className="text-[10px] text-slate-400 block">Weather</span>
                                            <b className="text-white text-sm">{weatherCounts}</b>
                                        </div>
                                        <div className="bg-slate-900/60 p-2 rounded-lg border border-borderSlate">
                                            <i className="fa-solid fa-car text-statusOrange mb-1 block text-lg"></i>
                                            <span className="text-[10px] text-slate-400 block">Traffic</span>
                                            <b className="text-white text-sm">{trafficCounts}</b>
                                        </div>
                                    </div>
                                </div>

                                {/* Block 4: Live AQI Monitoring */}
                                <div className="bg-panelBg border border-borderSlate rounded-xl p-3 flex flex-col justify-between min-w-0 h-full overflow-hidden">
                                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Live Air Quality</h4>
                                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1.5 mt-1 text-[10px]">
                                        {(() => {
                                            const sortedAqi = Object.keys(aqiData).map(city => ({
                                                name: city.split(",")[0],
                                                aqi: aqiData[city].aqi,
                                                pm2_5: aqiData[city].pm2_5
                                            })).sort((a, b) => b.aqi - a.aqi).slice(0, 3);
                                            
                                            if (sortedAqi.length === 0) {
                                                return <div className="text-slate-500 py-3 text-center">Loading AQI...</div>;
                                            }
                                            
                                            return sortedAqi.map((item, idx) => (
                                                <div key={idx} className="flex justify-between items-center bg-slate-900/60 p-1.5 rounded border border-borderSlate/30">
                                                    <span className="font-semibold text-slate-300 truncate w-14" title={item.name}>{item.name}</span>
                                                    <span className={`text-[8px] font-bold px-1 rounded uppercase shrink-0 ${
                                                        item.aqi > 150 ? 'bg-red-950/40 text-statusRed border border-statusRed/30' :
                                                        item.aqi > 100 ? 'bg-orange-950/40 text-statusOrange border border-statusOrange/30' :
                                                        'bg-emerald-950/40 text-statusGreen border border-statusGreen/20'
                                                    }`}>{item.aqi} AQI</span>
                                                </div>
                                            ));
                                        })()}
                                    </div>
                                </div>
 
                                {/* Block 5: Financial Overhead Analytics */}
                                <div className="bg-panelBg border border-borderSlate rounded-xl p-3 flex flex-col justify-between h-full overflow-hidden">
                                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Financial Overhead Trend</h4>
                                    <div className="flex-1 relative mt-1">
                                        <canvas ref={barChartRef}></canvas>
                                    </div>
                                </div>
 
                            </div>
                        </div>
                        )}
                        {activeTab === "weather" && (
                            <WeatherView 
                                citiesWeatherList={routeNetwork} 
                                hubsCoords={hubsCoords}
                                onOpenSettings={() => setSettingsOpen(true)}
                                isOwmFallback={isOwmFallback}
                                theme={theme}
                            />
                        )}
                        {activeTab === "locations" && (
                            <AddLocationView 
                                warehouses={warehouses}
                                hubsCoords={hubsCoords}
                                weatherData={weatherData}
                                aqiData={aqiData}
                                onAddWarehouse={handleAddWarehouse}
                                onAddCity={handleAddCity}
                            />
                        )}
                        {activeTab === "newOrder" && (
                            <CreateOrderView 
                                warehouses={warehouses}
                                hubsCoords={hubsCoords}
                                weatherData={weatherData}
                                aqiData={aqiData}
                                tomtomTrafficData={tomtomTrafficData}
                                newsAlerts={newsAlerts}
                                onAddOrder={handleAddOrder}
                                setActiveTab={setActiveTab}
                            />
                        )}
                    </div>

                    {/* Floating Hover Tooltip (Rendered outside nested scroll/hidden bounds, styled as fixed) */}
                    {hoveredDelay && (
                        <div 
                            className="fixed z-[9999] w-64 bg-slate-950/95 border border-borderSlate rounded-xl p-3 text-left shadow-2xl text-[11px] text-slate-300 font-sans backdrop-blur-md pointer-events-none transition-all duration-75 ease-out"
                            style={{ top: `${tooltipPos.top}px`, left: `${tooltipPos.left}px` }}
                        >
                            <div className="flex justify-between items-center border-b border-borderSlate/60 pb-1.5 mb-2">
                                <span className="font-bold text-white font-mono text-xs">{hoveredDelay.id}</span>
                                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase border ${
                                    hoveredDelay.status === "Delayed" ? "bg-red-950/60 text-statusRed border-statusRed/30 animate-pulse" : "bg-orange-950/60 text-statusOrange border-statusOrange/20"
                                }`}>{hoveredDelay.status}</span>
                            </div>
                            <div className="space-y-1.5">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Route Hub:</span>
                                    <span className="font-semibold text-slate-200">{hoveredDelay.destination}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Ideal Transit Time:</span>
                                    <span className="font-semibold text-slate-200">{hoveredDelay.baselineTime ? `${hoveredDelay.baselineTime.toFixed(1)}h` : "--"}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Delay Time:</span>
                                    <span className="font-bold text-statusRed font-mono">+{hoveredDelay.delayText}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Delayed Transit Time:</span>
                                    <span className="font-semibold text-slate-200">{hoveredDelay.delayedTime ? `${hoveredDelay.delayedTime.toFixed(1)}h` : "--"}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Financial Overhead:</span>
                                    <span className="font-bold text-amber-400 font-mono">₹{hoveredDelay.financialImpact.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Cargo Volume:</span>
                                    <span className="font-semibold text-slate-200 font-mono">{hoveredDelay.volume.toLocaleString()} kg</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Revised ETA:</span>
                                    <span className="font-semibold text-slate-200">{hoveredDelay.eta}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Order Date:</span>
                                    <span className="font-semibold text-slate-200 font-mono">{hoveredDelay.date}</span>
                                </div>
                                <div className="border-t border-borderSlate/40 pt-1.5 mt-1">
                                    <span className="text-slate-500 block mb-0.5 font-semibold">Incident Details:</span>
                                    <p className="text-[10px] text-slate-300 bg-slate-900/60 p-1.5 rounded border border-borderSlate/30 italic whitespace-normal leading-tight">
                                        {hoveredDelay.reason}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {settingsOpen && (
                        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/65 backdrop-blur-sm">
                            <div className="bg-panelBg border border-borderSlate w-full max-w-md p-6 rounded-2xl shadow-2xl relative">
                                <button 
                                    onClick={() => setSettingsOpen(false)}
                                    className="absolute top-4 right-4 text-slate-400 hover:text-white transition"
                                >
                                    <i className="fa-solid fa-xmark text-lg"></i>
                                </button>
                                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                                    <i className="fa-solid fa-gear text-brandBlue animate-spin" style={{ animationDuration: '4s' }}></i>
                                    Settings & Integration
                                </h3>
                                <p className="text-[10px] text-slate-400 mb-4">Configure credentials for live logistics telemetry services.</p>
                                
                                <div className="space-y-4">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider">OpenWeatherMap API Key</label>
                                        <input 
                                            type="password"
                                            value={apiKeyInput}
                                            onChange={(e) => setApiKeyInput(e.target.value)}
                                            placeholder="Paste your OpenWeatherMap API key here..."
                                            className="w-full bg-slate-900 border border-[#1e293b] rounded px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-brandBlue transition font-mono"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider">WeatherAPI Key (weatherapi.com)</label>
                                        <input 
                                            type="password"
                                            value={weatherApiKeyInput}
                                            onChange={(e) => setWeatherApiKeyInput(e.target.value)}
                                            placeholder="Paste your WeatherAPI key here..."
                                            className="w-full bg-slate-900 border border-[#1e293b] rounded px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-brandBlue transition font-mono"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider">Visual Crossing Weather API Key</label>
                                        <input 
                                            type="password"
                                            value={visualCrossingApiKeyInput}
                                            onChange={(e) => setVisualCrossingApiKeyInput(e.target.value)}
                                            placeholder="Paste your Visual Crossing Weather API key here..."
                                            className="w-full bg-slate-900 border border-[#1e293b] rounded px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-brandBlue transition font-mono"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider">WAQI API Token (aqicn.org)</label>
                                        <input 
                                            type="password"
                                            value={waqiApiKeyInput}
                                            onChange={(e) => setWaqiApiKeyInput(e.target.value)}
                                            placeholder="Paste your WAQI API token here..."
                                            className="w-full bg-slate-900 border border-[#1e293b] rounded px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-brandBlue transition font-mono"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider">TomTom Traffic API Key</label>
                                        <input 
                                            type="password"
                                            value={tomtomApiKeyInput}
                                            onChange={(e) => setTomtomApiKeyInput(e.target.value)}
                                            placeholder="Paste your TomTom API key here..."
                                            className="w-full bg-slate-900 border border-[#1e293b] rounded px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-brandBlue transition font-mono"
                                        />
                                        <span className="text-[8px] text-slate-500">Provide keys to unlock high-fidelity multi-provider weather cascading, dedicated AQI, and live route segment traffic.</span>
                                    </div>
                                </div>
                                
                                <div className="flex justify-end gap-3 mt-6 border-t border-borderSlate/40 pt-4">
                                    <button 
                                        onClick={() => setSettingsOpen(false)}
                                        className="px-3.5 py-1.5 border border-borderSlate hover:bg-slate-800 rounded text-[11px] text-slate-300 hover:text-white transition"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        onClick={() => saveConfigurations(apiKeyInput, weatherApiKeyInput, tomtomApiKeyInput, visualCrossingApiKeyInput, waqiApiKeyInput)}
                                        className="px-4 py-1.5 bg-brandBlue hover:bg-brandBlue/90 font-bold rounded text-[11px] text-white transition"
                                    >
                                        Save Configuration
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            );
        };

        export default App;
