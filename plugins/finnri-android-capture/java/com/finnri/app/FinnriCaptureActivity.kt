package com.finnri.app

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.Typeface
import android.media.MediaRecorder
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import java.io.File

/**
 * A capture-only lock-screen surface. It deliberately has no React view and no
 * access to ledger data. Once recording stops, MainActivity receives only the
 * cache-file URI; Android's normal keyguard still protects every financial
 * screen until the device is unlocked.
 */
class FinnriCaptureActivity : Activity() {
  private var recorder: MediaRecorder? = null
  private var outputFile: File? = null
  private lateinit var status: TextView
  private lateinit var action: Button

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED)
    }
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    renderCaptureOnlyUI()

    if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
      startCapture()
    } else {
      status.text = "Unlock and open Finnri once to allow microphone access."
      action.text = "Open Finnri"
      action.setOnClickListener { openMainWithoutCapture() }
    }
  }

  private fun renderCaptureOnlyUI() {
    val density = resources.displayMetrics.density
    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setPadding((32 * density).toInt(), (32 * density).toInt(), (32 * density).toInt(), (32 * density).toInt())
      setBackgroundColor(Color.parseColor("#2D2D2D"))
    }
    val title = TextView(this).apply {
      text = "Finnri quick capture"
      textSize = 24f
      setTextColor(Color.WHITE)
      setTypeface(typeface, Typeface.BOLD)
      gravity = Gravity.CENTER
    }
    status = TextView(this).apply {
      text = "Starting microphone…"
      textSize = 16f
      setTextColor(Color.parseColor("#CBD5E1"))
      gravity = Gravity.CENTER
      setPadding(0, (18 * density).toInt(), 0, (28 * density).toInt())
    }
    action = Button(this).apply {
      text = "Stop and review"
      textSize = 16f
      isAllCaps = false
      setTextColor(Color.WHITE)
      setBackgroundColor(Color.parseColor("#8257E5"))
      minHeight = (56 * density).toInt()
    }
    val privacy = TextView(this).apply {
      text = "Capture only. Balances and transactions stay behind your lock screen."
      textSize = 12f
      setTextColor(Color.parseColor("#94A3B8"))
      gravity = Gravity.CENTER
      setPadding(0, (24 * density).toInt(), 0, 0)
    }
    root.addView(title)
    root.addView(status)
    root.addView(action, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
    root.addView(privacy)
    setContentView(root)
  }

  private fun startCapture() {
    val target = File(cacheDir, "quick-capture-${System.currentTimeMillis()}.m4a")
    outputFile = target
    val nextRecorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      MediaRecorder(this)
    } else {
      @Suppress("DEPRECATION")
      MediaRecorder()
    }
    recorder = nextRecorder
    try {
      nextRecorder.setAudioSource(MediaRecorder.AudioSource.MIC)
      nextRecorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
      nextRecorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
      nextRecorder.setAudioEncodingBitRate(96_000)
      nextRecorder.setAudioSamplingRate(44_100)
      nextRecorder.setOutputFile(target.absolutePath)
      nextRecorder.prepare()
      nextRecorder.start()
      status.text = "Listening… say the transaction"
      action.setOnClickListener { finishCapture() }
    } catch (_: Exception) {
      releaseRecorder()
      target.delete()
      status.text = "Microphone could not start."
      action.text = "Open Finnri"
      action.setOnClickListener { openMainWithoutCapture() }
    }
  }

  private fun finishCapture() {
    val target = outputFile
    try {
      recorder?.stop()
    } catch (_: RuntimeException) {
      target?.delete()
    } finally {
      releaseRecorder()
    }
    if (target == null || !target.exists() || target.length() == 0L) {
      status.text = "That recording was too short."
      action.text = "Try again"
      action.setOnClickListener { startCapture() }
      return
    }
    // MainActivity is not allowed over the keyguard. If the device is still
    // locked, Android holds it behind the lock screen until authentication.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) setShowWhenLocked(false)
    val captureUri = Uri.fromFile(target).toString()
    val intent = Intent(this, MainActivity::class.java).apply {
      data = Uri.parse("ezmoney://?captureFile=${Uri.encode(captureUri)}")
      addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    }
    startActivity(intent)
    finish()
  }

  private fun openMainWithoutCapture() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) setShowWhenLocked(false)
    startActivity(Intent(this, MainActivity::class.java).apply {
      addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    })
    finish()
  }

  private fun releaseRecorder() {
    recorder?.reset()
    recorder?.release()
    recorder = null
  }

  override fun onDestroy() {
    if (recorder != null) {
      try { recorder?.stop() } catch (_: RuntimeException) { outputFile?.delete() }
      releaseRecorder()
    }
    super.onDestroy()
  }
}
