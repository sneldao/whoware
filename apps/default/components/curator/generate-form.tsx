import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

interface GenerateFormProps {
  figures: Array<{ _id: string; canonicalName: string; era: string; region: string }>;
  onGenerate: (figureId: string, slug: string) => void;
  isGenerating: boolean;
}

export function GenerateForm({ figures, onGenerate, isGenerating }: GenerateFormProps) {
  const [selectedFigureId, setSelectedFigureId] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const selectedFigure = figures.find((f) => f._id === selectedFigureId);
  const canSubmit = selectedFigureId && slug.trim() && !isGenerating;

  const handleGenerate = () => {
    if (!selectedFigureId || !slug.trim()) return;
    onGenerate(selectedFigureId, slug.trim());
    setSelectedFigureId(null);
    setSlug("");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Generate New Episode</Text>

      <View style={styles.field}>
        <Text style={styles.label}>Figure</Text>
        <Pressable
          style={styles.select}
          onPress={() => setShowDropdown(!showDropdown)}
        >
          <Text style={selectedFigure ? styles.selectText : styles.selectPlaceholder}>
            {selectedFigure
              ? `${selectedFigure.canonicalName} (${selectedFigure.era})`
              : "Select a figure..."}
          </Text>
          <Ionicons name={showDropdown ? "chevron-up" : "chevron-down"} size={16} color="#94a3b8" />
        </Pressable>

        {showDropdown && (
          <View style={styles.dropdown}>
            {figures.map((figure) => (
              <Pressable
                key={figure._id}
                style={[
                  styles.dropdownItem,
                  figure._id === selectedFigureId && styles.dropdownItemActive,
                ]}
                onPress={() => {
                  setSelectedFigureId(figure._id);
                  setShowDropdown(false);
                }}
              >
                <Text style={styles.dropdownText}>
                  {figure.canonicalName} — {figure.region}, {figure.era}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Episode Slug</Text>
        <TextInput
          style={styles.input}
          value={slug}
          onChangeText={setSlug}
          placeholder="e.g. ep-006-curie"
          placeholderTextColor="#64748b"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <Pressable
        style={[styles.button, !canSubmit && styles.buttonDisabled]}
        onPress={handleGenerate}
        disabled={!canSubmit}
      >
        {isGenerating ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Ionicons name="sparkles" size={16} color="#fff" />
            <Text style={styles.buttonText}>Generate Episode</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#0f172a",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    padding: 20,
    gap: 16,
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
    fontSize: 13,
    fontWeight: "500",
  },
  select: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#475569",
    borderRadius: 8,
    padding: 12,
  },
  selectText: {
    color: "#f8fafc",
    fontSize: 14,
  },
  selectPlaceholder: {
    color: "#64748b",
    fontSize: 14,
  },
  dropdown: {
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#475569",
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 200,
    overflow: "scroll",
  },
  dropdownItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  dropdownItemActive: {
    backgroundColor: "#334155",
  },
  dropdownText: {
    color: "#e2e8f0",
    fontSize: 13,
  },
  input: {
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#475569",
    borderRadius: 8,
    padding: 12,
    color: "#f8fafc",
    fontSize: 14,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#8b5cf6",
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
