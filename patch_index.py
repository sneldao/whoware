with open('/Users/udingethe/Dev/whoware/apps/default/app/index.tsx', 'r') as f:
    content = f.read()

# 1. Add revealGuessOnChain import
content = content.replace(
    'import { commitGuessOnChain, generateGuessSalt } from "@/lib/wallet";',
    'import { commitGuessOnChain, revealGuessOnChain, generateGuessSalt } from "@/lib/wallet";'
)

# 2. Update handleGuess to commit on-chain before submitting
old = '''    const figureId = _figureId as Id<"figures">;
    const activeRun = await ensureRun();

    if (!hasEnteredMemory) {
      await enterSceneMutation({ runId: activeRun._id, sceneIndex: 0 });
    }

    const result = await submitGuessMutation({'''

new = '''    const figureId = _figureId as Id<"figures">;
    const activeRun = await ensureRun();

    if (!hasEnteredMemory) {
      await enterSceneMutation({ runId: activeRun._id, sceneIndex: 0 });
    }

    // Commit-reveal: commit guess on-chain before submitting (competitive mode)
    if (episode.competitiveMode && wallet.address && !commitState?.hasCommitted) {
      const salt = generateGuessSalt();
      setCommitState({ guess: _guessText, salt, txHash: null, isCommitting: true, hasCommitted: false });
      const episodeDay = Math.max(1, Math.floor(episode.dropsAt / 86400000));
      const txHash = await commitGuessOnChain(wallet.address, episodeDay, _guessText, salt);
      setCommitState((prev) => prev ? { ...prev, txHash, isCommitting: false, hasCommitted: !!txHash } : null);
      if (!txHash) {
        setStatus("Could not commit guess on-chain. Check your wallet connection and try again.");
        return;
      }
    }

    const result = await submitGuessMutation({'''

if old not in content:
    print('ERROR: handleGuess pattern not found')
else:
    content = content.replace(old, new)
    print('handleGuess patched')

# 3. After correct guess, reveal on-chain if competitive mode
old = '''      if (wallet.address && !hasMintedRef.current) {
        hasMintedRef.current = true;
        const episodeDay = Math.max(1, Math.floor(episode.dropsAt / 86400000));

        setIsMinting(true);'''

new = '''      if (wallet.address && !hasMintedRef.current) {
        hasMintedRef.current = true;
        const episodeDay = Math.max(1, Math.floor(episode.dropsAt / 86400000));

        // Reveal on-chain if competitive mode and we committed
        if (episode.competitiveMode && commitState?.hasCommitted && wallet.address) {
          await revealGuessOnChain(wallet.address, episodeDay, commitState.guess, commitState.salt);
        }

        setIsMinting(true);'''

if old not in content:
    print('ERROR: minting pattern not found')
else:
    content = content.replace(old, new)
    print('reveal patched')

with open('/Users/udingethe/Dev/whoware/apps/default/app/index.tsx', 'w') as f:
    f.write(content)
print('done')
