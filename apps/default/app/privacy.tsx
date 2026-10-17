import { ScrollView, StyleSheet, Text, View } from "react-native";

/**
 * Privacy policy for the WhoWare Anna App.
 *
 * Reachable at /privacy, which is the URL submitted as the Developer Console
 * "Privacy policy URL". Kept deliberately plain and factual: the app stores
 * almost nothing, and the policy says exactly what that is.
 */
export default function PrivacyScreen() {
  return (
    <ScrollView style={s.root} contentContainerStyle={s.body}>
      <Text style={s.h1}>Privacy</Text>
      <Text style={s.lede}>
        WhoWare stores the minimum needed to remember your streak. It does not track
        you, and it does not sell or share anything.
      </Text>

      <Text style={s.h2}>What is stored</Text>
      <Text style={s.p}>
        While you play, we save your progress for the current day and a short history
        across days:
      </Text>
      <Bullet>Your streak, best streak, and remaining freezes</Bullet>
      <Bullet>Which clues you opened and the guesses you made that day</Bullet>
      <Bullet>Your score and detective grade per day, for the last 60 days</Bullet>
      <Bullet>An anonymous identifier so a returning player keeps their streak</Bullet>

      <Text style={s.h2}>Where it lives</Text>
      <Text style={s.p}>
        In Anna&apos;s own per-user storage, in a bucket belonging to this app and to
        you. It is not shared with us as a marketing list, and it is not combined with
        any other app. Deleting the app or your Anna account removes it.
      </Text>

      <Text style={s.h2}>What we never do</Text>
      <Bullet>No advertising or third-party trackers</Bullet>
      <Bullet>No selling or sharing your data</Bullet>
      <Bullet>No third-party analytics SDKs</Bullet>
      <Bullet>No collection of contacts, location, or device identifiers</Bullet>

      <Text style={s.h2}>AI models</Text>
      <Text style={s.p}>
        The figure in the room speaks to you. When that dialogue is generated, only
        in-game context is sent to the model — the room, the clue, and the historical
        figure involved. Nothing about you is included. Generation runs on whatever
        model provider you have enabled in Anna, charged against your own quota.
      </Text>

      <Text style={s.h2}>Contact</Text>
      <Text style={s.p}>Questions: open an issue on the project repository.</Text>

      <View style={s.foot}>
        <Text style={s.footText}>Last updated 17 October 2026</Text>
      </View>
    </ScrollView>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={s.bulletRow}>
      <Text style={s.bulletDot}>·</Text>
      <Text style={s.bullet}>{children}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#14181c" },
  body: { padding: 22, paddingBottom: 56, maxWidth: 680 },
  h1: { color: "#efe6d6", fontSize: 28, marginBottom: 6 },
  h2: { color: "#c9a227", fontSize: 12, letterSpacing: 2, marginTop: 26, marginBottom: 8 },
  lede: { color: "#efe6d6", fontSize: 15, lineHeight: 24, marginBottom: 4 },
  p: { color: "#c8c2b4", fontSize: 14, lineHeight: 23, marginBottom: 6 },
  bulletRow: { flexDirection: "row", paddingLeft: 4, marginBottom: 4 },
  bulletDot: { color: "#c9a227", fontSize: 18, lineHeight: 22, width: 16 },
  bullet: { color: "#c8c2b4", fontSize: 14, lineHeight: 22, flex: 1 },
  foot: { marginTop: 30, borderTopWidth: 1, borderTopColor: "#2a2f35", paddingTop: 14 },
  footText: { color: "#7d8189", fontSize: 11 },
});
