"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "../../providers/AuthProvider";

import { FcHome } from "react-icons/fc";
import { FcPlanner } from "react-icons/fc";
import { FcOvertime } from "react-icons/fc";
import { FcAlarmClock } from "react-icons/fc";
import { FcBusinessman } from "react-icons/fc";
import { FcCrystalOscillator } from "react-icons/fc";
import { FcOrgUnit } from "react-icons/fc";
import { FcCollaboration } from "react-icons/fc";
import { FcCurrencyExchange } from "react-icons/fc";

interface SidebarProps {
  isOpen: boolean;
}

export default function Sidebar({ isOpen }: SidebarProps) {
  const [activeMenu, setActiveMenu] = useState("");
  const { user } = useAuth();

  return (
    <aside className={`bg-white border-r border-gray-200 fixed top-0 left-0 z-40 h-screen w-64 transition-transform duration-300 ease-in-out ${ isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} shadow-lg`}>
      <div className="h-16 px-3 flex items-center justify-start border-b border-gray-200">
        <Link href="/" className="logo">
          <Image src="/getsettime-logo.svg" alt="GetSetTime Logo" width={150} height={40} />
        </Link>
      </div>

      <div className="py-6 px-3">
        <nav className="space-y-1">
          <Link href="/" className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md ${activeMenu === "dashboard" ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-50"}`} onClick={() => setActiveMenu("dashboard")}>
            <FcHome className="h-5 w-5 mr-3" />
            Dashboard
          </Link>
          <Link href="/event-type" className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md ${ activeMenu === "event-type" ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-50" }`} onClick={() => setActiveMenu("event-type")}>
            <FcOvertime className="h-5 w-5 mr-3" />
            Event Type
          </Link> 
          <Link href="/bookings" className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md ${ activeMenu === "bookings" ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-50" }`} onClick={() => setActiveMenu("bookings")}>
            <FcPlanner className="h-5 w-5 mr-3" />
            Bookings
          </Link>       
          <Link href="/availability" className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md ${ activeMenu === "availability" ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-50" }`} onClick={() => setActiveMenu("availability")}>
            <FcAlarmClock className="h-5 w-5 mr-3" />
            Availability
          </Link>        
          <Link href="/routingform" className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md ${ activeMenu === "routingform" ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-50" }`} onClick={() => setActiveMenu("routingform")}>
            <svg className="h-7 w-7 mr-2" viewBox="-2.4 -2.4 28.80 28.80" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier"></g><g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M16.5 4.25C18.8472 4.25 20.75 6.15279 20.75 8.5C20.75 10.8472 18.8472 12.75 16.5 12.75H7.5C5.98122 12.75 4.75 13.9812 4.75 15.5C4.75 17.0188 5.98122 18.25 7.5 18.25H18.1893L17.4697 17.5303C17.1768 17.2374 17.1768 16.7626 17.4697 16.4697C17.7626 16.1768 18.2374 16.1768 18.5303 16.4697L20.5303 18.4697C20.8232 18.7626 20.8232 19.2374 20.5303 19.5303L18.5303 21.5303C18.2374 21.8232 17.7626 21.8232 17.4697 21.5303C17.1768 21.2374 17.1768 20.7626 17.4697 20.4697L18.1893 19.75H7.5C5.15279 19.75 3.25 17.8472 3.25 15.5C3.25 13.1528 5.15279 11.25 7.5 11.25H16.5C18.0188 11.25 19.25 10.0188 19.25 8.5C19.25 6.98122 18.0188 5.75 16.5 5.75H7.85462C7.55793 6.48296 6.83934 7 6 7C4.89543 7 4 6.10457 4 5C4 3.89543 4.89543 3 6 3C6.83934 3 7.55793 3.51704 7.85462 4.25H16.5Z" fill="#1C274C"></path> </g></svg>
            Routing & Forms
          </Link>        
          <Link href="/workflows" className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md ${ activeMenu === "workflows" ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-50" }`} onClick={() => setActiveMenu("workflows")}>
            <FcOrgUnit className="h-5 w-5 mr-3" />
            Workflows
          </Link>        
          <Link href="/integrations" className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md ${ activeMenu === "integrations" ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-50" }`} onClick={() => setActiveMenu("integrations")}>
            <FcCrystalOscillator className="h-5 w-5 mr-3" />
            Integrations
          </Link>        
          <Link href="/team" className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md ${ activeMenu === "team" ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-50" }`} onClick={() => setActiveMenu("team")}>
            <FcCollaboration className="h-5 w-5 mr-3" />
            Team & Roles
          </Link>        
          <Link href="/billings" className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md ${ activeMenu === "billings" ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-50" }`} onClick={() => setActiveMenu("billings")}>
            <FcCurrencyExchange className="h-5 w-5 mr-3" />
            Billings
          </Link>  
          <Link href="/profile" className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md ${ activeMenu === "profile" ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-50" }`} onClick={() => setActiveMenu("profile")}>
            <FcBusinessman className="h-5 w-5 mr-3" />
            Profile
          </Link>        
        </nav>
      </div>

      <div className="bg-white absolute bottom-0 w-full border-t border-gray-200 p-4">
        <div className="flex items-center">
          <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white">
            <span className="text-sm font-medium">
              {user?.email ? user.email.charAt(0).toUpperCase() : "U"}
            </span>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-gray-700 truncate max-w-[150px]">
              {user?.user_metadata?.name || user?.email?.split('@')[0] || "User"}
            </p>
            <p className="text-xs text-gray-500 truncate max-w-[150px]">
              {user?.email || "user@example.com"}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

