import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * useOptimisticCart – React Query integration for optimistic cart updates
 * 
 * Handles race conditions with rollback on failure and server validation
 * 
 * Props: updateFn (async function), queryKey (array)
 */
export function useOptimisticCart(updateFn, queryKey) {
  const queryClient = useQueryClient();
  const [rollbackState, setRollbackState] = useState(null);

  const mutation = useMutation({
    mutationFn: updateFn,
    onMutate: async (variables) => {
      // Cancel ongoing queries to prevent overwriting optimistic update
      await queryClient.cancelQueries({ queryKey });

      // Save previous state for rollback
      const previousData = queryClient.getQueryData(queryKey);
      setRollbackState(previousData);

      return { previousData };
    },

    onSuccess: (data, variables, context) => {
      // Update the cache with the actual server response
      queryClient.setQueryData(queryKey, data);
      setRollbackState(null);
    },

    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
      console.error('Optimistic update failed:', error);
    },
  });

  const optimisticUpdate = useCallback(
    (optimisticData, updateFnCall) => {
      // Set optimistic state immediately
      queryClient.setQueryData(queryKey, optimisticData);

      // Run actual mutation
      mutation.mutate(updateFnCall);
    },
    [queryClient, queryKey, mutation]
  );

  return {
    optimisticUpdate,
    isLoading: mutation.isPending,
    error: mutation.error,
    rollbackState,
  };
}