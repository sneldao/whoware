import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { Id } from "@/convex/_generated/dataModel";
import { theme } from "@/lib/theme";

interface FigureOption {
  _id: Id<"figures">;
  canonicalName: string;
  era: string;
  region: string;
}

interface GenerateFormProps {
  figures: FigureOption[];
  onGenerate: (figureId: string, slug: string) => Promise<void>;
  isGenerating: boolean;
}

export function GenerateForm({ figures, onGenerate, isGenerating }: GenerateFormProps) {
  const [selectedFigureId, setSelectedFigureId] = useState<string>("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);

  const selectedFigure = figures.find((f) => f._id === selectedFigureId);

  async function handleSubmit() {
    setError(null);
    if (!selectedFigureId) {
      setError("Select a figure first.");
      return;
    }
    const slugValue = slug.trim() || `episode-${Date.now()}`;
    try {
      await onGenerate(selectedFigureId, slugValue);
      setSelectedFigureId("");
      setSlug("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed.");
    }
  }

  return (
    <View style={styles.form}>
      <Text style={styles.title}>Generate Episode</Text>

      <View style={styles.field}>
        <Text style={styles.label}>Historical figure</Text>
        <View style={styles.figureList}>
          {figures.length === 0 ? (
            <Text style={styles.emptyText}>No figures in catalog. Seed the catalog first.</Text>
          ) : (
            figures.map((figure) => (
              <Pressable
                key={figure._id}
                style={({ pressed }) => [
                  styles.figureOption,
                  selectedFigureId === figure._id && styles.figureOptionSelected,
                  pressed && styles.pressed,
                ]}
                onPress={() => setSelectedFigureId(figure._id)}
              >
                <View style={styles.figureInfo}>
                  <Text
                    style={[
                      styles.figureName,
                      selectedFigureId === figure._id && styles.figureNameSelected,
                    ]}
                  >
                    {figure.canonicalName}
                  </Text>
                  <Text style={styles.figureMeta}>
                    {figure.era} · {figure.region}
                  </Text>
                </View>
                {selectedFigureId === figure._id && (
                  <Ionicons name="checkmark-circle" size={18} color={theme.success} />
                )}
              </Pressable>
            ))
          )}
        </View>
      </View>

      {selectedFigure && (
        <View style={styles.selectedPreview}>
          <Ionicons name="person" size={16} color={theme.accent} />
          <Text style={styles.selectedText}>
            Selected: {selectedFigure.canonicalName} ({selectedFigure.era})
          </Text>
        </View>
      )}

      <View style={styles.field}>
        <Text style={styles.label}>Slug (optional)</Text>
        <TextInput
          value={slug}
          onChangeText={setSlug}
          placeholder="e.g. episode-2026-06-08"
          placeholderTextColor={theme.neutralDark}
          style={styles.input}
        />
        <Text style={styles.hint}>Auto-generated if left blank</Text>
      </View>

      {error && (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle" size={14} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <Pressable
        style={({ pressed }) => [
          styles.submitButton,
          pressed && styles.pressed,
          isGenerating && styles.submitButtonDisabled,
        ]}
        onPress={handleSubmit}
        disabled={isGenerating || !selectedFigureId}
      >
        {isGenerating ? (
          <>
            <ActivityIndicator size="small" color={theme.inkOnAccent} />
            <Text style={styles.submitButtonText}>Generating…</Text>
          </>
        ) : (
          <>
            <Ionicons name="sparkles" size={16} color={theme.inkOnAccent} />
            <Text style={styles.submitButtonText}>Generate Episode</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    padding: 16,
    gap: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#0f172a",
  },
  title: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "700",
  },
  field: {
    gap: 6,
  },
  label: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  figureList: {
    maxHeight: 200,
    gap: 6,
  },
  emptyText: {
    color: theme.neutralDark,
    fontSize: 13,
    fontStyle: "italic",
  },
  figureOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1e293b",
    backgroundColor: "#1e293b",
    gap: 8,
  },
  figureOptionSelected: {
    borderColor: theme.success,
    backgroundColor: "rgba(34, 197, 94, 0.08)",
  },
  figureInfo: {
    flex: 1,
    gap: 2,
  },
  figureName: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "600",
  },
  figureNameSelected: {
    color: theme.success,
  },
  figureMeta: {
    color: "#64748b",
    fontSize: 11,
  },
  selectedPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: theme.accentAlpha8,
    borderWidth: 1,
    borderColor: theme.accentAlpha20,
  },
  selectedText: {
    color: theme.accent,
    fontSize: 13,
    fontWeight: "700",
  },
  input: {
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#1e293b",
    color: "#f8fafc",
    fontSize: 14,
  },
  hint: {
    color: theme.neutralDark,
    fontSize: 11,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
  },
  errorText: {
    color: "#EF4444",
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: theme.accent,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: theme.inkOnAccent,
    fontSize: 14,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.72,
  },
});
