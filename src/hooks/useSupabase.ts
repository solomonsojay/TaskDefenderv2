import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, auth, db } from '../lib/supabase';
import { useApp } from '../contexts/AppContext';

export const useSupabase = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { setUser: setAppUser, dispatch } = useApp();

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const { user: currentUser } = await auth.getCurrentUser();
      setUser(currentUser);
      
      if (currentUser) {
        await loadUserProfile(currentUser.id);
      }
      
      setLoading(false);
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      
      if (session?.user) {
        await loadUserProfile(session.user.id);
      } else {
        setAppUser(null);
        dispatch({ type: 'SET_TASKS', payload: [] });
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [setAppUser, dispatch]);

  const loadUserProfile = async (userId: string) => {
    try {
      const { data: profile, error } = await db.getProfile(userId);
      
      if (error) {
        console.error('Error loading profile:', error);
        return;
      }

      if (profile) {
        // Convert Supabase profile to app user format
        const appUser = {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          role: profile.role as 'user' | 'admin',
          goals: profile.goals || [],
          workStyle: profile.work_style as 'focused' | 'flexible' | 'collaborative',
          integrityScore: profile.integrity_score,
          streak: profile.streak,
          walletAddress: profile.wallet_address || undefined,
          createdAt: new Date(profile.created_at)
        };

        setAppUser(appUser);
        dispatch({ type: 'COMPLETE_ONBOARDING' });

        // Load user's tasks
        await loadUserTasks(userId);
      }
    } catch (error) {
      console.error('Error in loadUserProfile:', error);
    }
  };

  const loadUserTasks = async (userId: string) => {
    try {
      const { data: tasks, error } = await db.getTasks(userId);
      
      if (error) {
        console.error('Error loading tasks:', error);
        return;
      }

      if (tasks) {
        // Convert Supabase tasks to app task format
        const appTasks = tasks.map(task => ({
          id: task.id,
          title: task.title,
          description: task.description || '',
          priority: task.priority as 'low' | 'medium' | 'high' | 'urgent',
          status: task.status as 'todo' | 'in-progress' | 'blocked' | 'done',
          dueDate: task.due_date ? new Date(task.due_date) : undefined,
          startDate: task.start_date ? new Date(task.start_date) : undefined,
          estimatedTime: task.estimated_time || undefined,
          actualTime: task.actual_time || undefined,
          tags: task.tags || [],
          createdAt: new Date(task.created_at),
          completedAt: task.completed_at ? new Date(task.completed_at) : undefined,
          userId: task.user_id,
          teamId: task.team_id || undefined,
          honestlyCompleted: task.honestly_completed,
          // Convert work patterns if they exist
          workPattern: task.work_patterns?.[0] ? {
            totalTimeSpent: task.work_patterns[0].total_time_spent,
            sessionsCount: task.work_patterns[0].sessions_count,
            averageSessionLength: task.work_patterns[0].average_session_length,
            productiveHours: task.work_patterns[0].productive_hours,
            procrastinationScore: task.work_patterns[0].procrastination_score,
            consistencyScore: task.work_patterns[0].consistency_score,
            lastWorkedOn: task.work_patterns[0].last_worked_on ? new Date(task.work_patterns[0].last_worked_on) : undefined
          } : undefined,
          // Convert time blocks if they exist
          timeBlocks: task.time_blocks?.map(block => ({
            id: block.id,
            startTime: new Date(block.start_time),
            endTime: new Date(block.end_time),
            duration: block.duration,
            isScheduled: block.is_scheduled,
            isCompleted: block.is_completed,
            notes: block.notes || undefined
          })) || []
        }));

        dispatch({ type: 'SET_TASKS', payload: appTasks });
      }
    } catch (error) {
      console.error('Error in loadUserTasks:', error);
    }
  };

  const signUp = async (email: string, password: string, userData: { name: string }) => {
    setLoading(true);
    const result = await auth.signUp(email, password, userData);
    setLoading(false);
    return result;
  };

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    const result = await auth.signIn(email, password);
    setLoading(false);
    return result;
  };

  const signOut = async () => {
    setLoading(true);
    const result = await auth.signOut();
    setLoading(false);
    return result;
  };

  const createTask = async (taskData: any) => {
    if (!user) return { data: null, error: new Error('User not authenticated') };

    const supabaseTask = {
      title: taskData.title,
      description: taskData.description || null,
      priority: taskData.priority || 'medium',
      status: taskData.status || 'todo',
      due_date: taskData.dueDate?.toISOString() || null,
      start_date: taskData.startDate?.toISOString() || null,
      estimated_time: taskData.estimatedTime || null,
      tags: taskData.tags || [],
      user_id: user.id,
      team_id: taskData.teamId || null
    };

    const { data, error } = await db.createTask(supabaseTask);
    
    if (!error && data) {
      // Reload tasks to get the updated list
      await loadUserTasks(user.id);
    }
    
    return { data, error };
  };

  const updateTask = async (taskId: string, updates: any) => {
    if (!user) return { data: null, error: new Error('User not authenticated') };

    const supabaseUpdates: any = {};
    
    // Map app fields to Supabase fields
    if (updates.title !== undefined) supabaseUpdates.title = updates.title;
    if (updates.description !== undefined) supabaseUpdates.description = updates.description;
    if (updates.priority !== undefined) supabaseUpdates.priority = updates.priority;
    if (updates.status !== undefined) supabaseUpdates.status = updates.status;
    if (updates.dueDate !== undefined) supabaseUpdates.due_date = updates.dueDate?.toISOString() || null;
    if (updates.startDate !== undefined) supabaseUpdates.start_date = updates.startDate?.toISOString() || null;
    if (updates.estimatedTime !== undefined) supabaseUpdates.estimated_time = updates.estimatedTime;
    if (updates.actualTime !== undefined) supabaseUpdates.actual_time = updates.actualTime;
    if (updates.tags !== undefined) supabaseUpdates.tags = updates.tags;
    if (updates.completedAt !== undefined) supabaseUpdates.completed_at = updates.completedAt?.toISOString() || null;
    if (updates.honestlyCompleted !== undefined) supabaseUpdates.honestly_completed = updates.honestlyCompleted;

    const { data, error } = await db.updateTask(taskId, supabaseUpdates);
    
    if (!error) {
      // Reload tasks to get the updated list
      await loadUserTasks(user.id);
      
      // Update integrity score if task was completed
      if (updates.status === 'done') {
        await db.calculateIntegrityScore(user.id);
        await db.updateUserStreak(user.id);
        // Reload profile to get updated scores
        await loadUserProfile(user.id);
      }
    }
    
    return { data, error };
  };

  const deleteTask = async (taskId: string) => {
    if (!user) return { error: new Error('User not authenticated') };

    const { error } = await db.deleteTask(taskId);
    
    if (!error) {
      // Reload tasks to get the updated list
      await loadUserTasks(user.id);
    }
    
    return { error };
  };

  const createFocusSession = async (taskId: string) => {
    if (!user) return { data: null, error: new Error('User not authenticated') };

    const session = {
      task_id: taskId,
      user_id: user.id,
      duration: 0,
      completed: false,
      distractions: 0,
      session_type: 'work' as const
    };

    return await db.createFocusSession(session);
  };

  const updateFocusSession = async (sessionId: string, updates: any) => {
    const supabaseUpdates: any = {};
    
    if (updates.duration !== undefined) supabaseUpdates.duration = updates.duration;
    if (updates.completed !== undefined) supabaseUpdates.completed = updates.completed;
    if (updates.distractions !== undefined) supabaseUpdates.distractions = updates.distractions;
    if (updates.ended_at !== undefined) supabaseUpdates.ended_at = updates.ended_at?.toISOString() || null;

    return await db.updateFocusSession(sessionId, supabaseUpdates);
  };

  return {
    user,
    loading,
    signUp,
    signIn,
    signOut,
    createTask,
    updateTask,
    deleteTask,
    createFocusSession,
    updateFocusSession,
    loadUserProfile,
    loadUserTasks
  };
};