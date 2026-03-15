import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Heart, MessageCircleHeart, Mic, User } from 'lucide-react';

export default function Layout() {
  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-50 font-sans">
      <main className="flex-1 overflow-y-auto relative">
        <Outlet />
      </main>
      
      <nav className="bg-zinc-900 border-t border-zinc-800 pb-safe">
        <div className="flex justify-around items-center h-16 px-4">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center w-full h-full transition-colors ${
                isActive ? 'text-lime-500' : 'text-zinc-500 hover:text-zinc-300'
              }`
            }
          >
            <Heart className="w-6 h-6" />
            <span className="text-[10px] mt-1 font-medium">Discover</span>
          </NavLink>
          
          <NavLink
            to="/matches"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center w-full h-full transition-colors ${
                isActive ? 'text-lime-500' : 'text-zinc-500 hover:text-zinc-300'
              }`
            }
          >
            <MessageCircleHeart className="w-6 h-6" />
            <span className="text-[10px] mt-1 font-medium">Matches</span>
          </NavLink>
          
          <NavLink
            to="/coach"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center w-full h-full transition-colors ${
                isActive ? 'text-lime-500' : 'text-zinc-500 hover:text-zinc-300'
              }`
            }
          >
            <Mic className="w-6 h-6" />
            <span className="text-[10px] mt-1 font-medium">Coach</span>
          </NavLink>
          
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center w-full h-full transition-colors ${
                isActive ? 'text-lime-500' : 'text-zinc-500 hover:text-zinc-300'
              }`
            }
          >
            <User className="w-6 h-6" />
            <span className="text-[10px] mt-1 font-medium">Profile</span>
          </NavLink>
        </div>
      </nav>
    </div>
  );
}
